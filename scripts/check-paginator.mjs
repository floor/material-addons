// The paginator in a browser: themes and direction, geometry, tab order,
// the cancelable change, forced colours, reduced motion, and the four
// adapters.
//
//   bun run build --production && node scripts/check-paginator.mjs
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { compile } from "svelte/compiler";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  resolve: { conditions: ["svelte", "module", "browser", "development"] },
  cacheDir: "node_modules/.vite-paginator",
  optimizeDeps: { entries: ["test/browser/paginator-adapters.html"], exclude: ["material-addons/svelte", "svelte"] },
  server: { host: "127.0.0.1", port: 0, hmr: false },
  plugins: [{
    name: "compile-svelte-fixture",
    transform(source, filename) {
      if (!filename.endsWith(".svelte")) return;
      return compile(source, { filename, generate: "client" }).js;
    },
  }],
});

let browser;
try {
  await server.listen();
  const { port } = server.httpServer.address();
  browser = await chromium.launch();
  const base = `http://127.0.0.1:${port}`;
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
  const reset = async () => {
    await page.goto(`${base}/test/browser/paginator.html`);
    await page.waitForFunction(() => !!window.paginator);
  };

  // Themes and direction: the first control sits at the inline start and the
  // chevrons mirror; each target is 48x48
  for (const mode of ["light", "dark"]) {
    for (const direction of ["ltr", "rtl"]) {
      await reset();
      const geometry = await page.evaluate(({ mode, direction }) => {
        document.documentElement.dataset.themeMode = mode;
        document.documentElement.dir = direction;
        document.body.replaceChildren();
        const paginator = window.paginator.createPaginator({ total: 100, page: 2, numbered: true });
        document.body.append(paginator.element);
        const root = paginator.element.querySelector(".mtrl-paginator__navigation").getBoundingClientRect();
        const button = paginator.element.querySelector(".mtrl-paginator__button");
        const box = button.getBoundingClientRect();
        const icon = button.querySelector("svg");
        const first = paginator.element.querySelector(".mtrl-paginator__button--first").getBoundingClientRect();
        const last = paginator.element.querySelector(".mtrl-paginator__button--last").getBoundingClientRect();
        return {
          width: box.width,
          height: box.height,
          firstEdge: direction === "ltr" ? first.left - root.left : root.right - first.right,
          lastEdge: direction === "ltr" ? root.right - last.right : last.left - root.left,
          iconMirrored: getComputedStyle(icon).transform !== "none",
          current: getComputedStyle(paginator.element.querySelector('[aria-current="page"]')).backgroundColor,
        };
      }, { mode, direction });
      assert.equal(geometry.width, 48, `${mode}/${direction} button width`);
      assert.equal(geometry.height, 48, `${mode}/${direction} button height`);
      assert.ok(geometry.firstEdge < 8, `${mode}/${direction} first at the inline start`);
      assert.ok(geometry.lastEdge < 8, `${mode}/${direction} last at the inline end`);
      assert.equal(geometry.iconMirrored, direction === "rtl", `${mode}/${direction} chevrons mirror`);
      assert.notEqual(geometry.current, "rgba(0, 0, 0, 0)", `${mode}/${direction} current page fills`);
    }
  }

  // Tab order and the cancelable change
  await reset();
  const keyboard = await page.evaluate(async () => {
    document.body.replaceChildren();
    document.body.innerHTML = `<m-paginator total="100" page="1" numbered></m-paginator>`;
    window.paginator.definePaginator();
    const host = document.querySelector("m-paginator");
    const component = host.component;
    const root = host.shadowRoot;
    const order = [...root.querySelectorAll("select, button")].map((node) => node.className || node.localName);
    const detail = [];
    let cancel = false;
    host.addEventListener("change", (event) => {
      detail.push(event.detail);
      if (cancel) event.preventDefault();
    });
    root.querySelector(".mtrl-paginator__button--next").click();
    const moved = component.getPage();
    cancel = true;
    root.querySelector(".mtrl-paginator__button--next").click();
    return { order, detail, moved, afterCancel: component.getPage() };
  });
  assert.equal(keyboard.order[0], "mtrl-paginator__page-size-select");
  assert.equal(keyboard.order[1], "mtrl-paginator__button mtrl-paginator__button--first");
  assert.ok(keyboard.order.includes("mtrl-paginator__page"));
  assert.ok(keyboard.order.indexOf("mtrl-paginator__button mtrl-paginator__button--next") > keyboard.order.indexOf("mtrl-paginator__page"));
  assert.deepEqual(keyboard.detail, [{ page: 2, pageSize: 25 }, { page: 3, pageSize: 25 }]);
  assert.equal(keyboard.moved, 2);
  assert.equal(keyboard.afterCancel, 2);

  // Numbered pages: Enter keeps focus on the new current button, and a
  // button held past destroy commits nothing
  await reset();
  const numbered = await page.evaluate(async () => {
    document.body.replaceChildren();
    const paginator = window.paginator.createPaginator({ total: 500, pageSize: 25, page: 1, numbered: true });
    document.body.append(paginator.element);
    const buttons = () => Array.from(paginator.element.querySelectorAll(".mtrl-paginator__page"));
    const target = buttons().find((button) => button.textContent === "2");
    target.focus();
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    // A native Enter on a button is a click; send it as the browser would
    target.click();
    const current = paginator.element.querySelector(".mtrl-paginator__page--current");
    const kept = document.activeElement === current && current.textContent === "2";
    const held = buttons().find((button) => button.textContent !== "2");
    const seen = [];
    paginator.on("beforechange", (event) => seen.push(event.page));
    paginator.destroy();
    held.click();
    return { kept, page: paginator.getPage(), seen };
  });
  assert.equal(numbered.kept, true, "keyboard activation keeps focus on the new current page");
  assert.equal(numbered.page, 2, "a numbered button held past destroy commits nothing");
  assert.deepEqual(numbered.seen, [], "and emits nothing");

  // Forced colours and reduced motion
  await reset();
  await page.emulateMedia({ forcedColors: "active" });
  const forced = await page.evaluate(() => {
    document.body.replaceChildren();
    const paginator = window.paginator.createPaginator({ total: 100, page: 2, numbered: true });
    document.body.append(paginator.element);
    const probe = document.createElement("div");
    probe.style.cssText = "forced-color-adjust:none;color:HighlightText;background:Highlight;border-color:ButtonText;outline-color:Highlight";
    document.body.append(probe);
    const current = paginator.element.querySelector('[aria-current="page"]');
    const disabled = paginator.element.querySelector(".mtrl-paginator__button:disabled");
    return {
      currentBg: getComputedStyle(current).backgroundColor,
      currentFg: getComputedStyle(current).color,
      highlight: getComputedStyle(probe).backgroundColor,
      highlightText: getComputedStyle(probe).color,
      disabled: disabled ? getComputedStyle(disabled).color : "",
      grayText: (() => { probe.style.color = "GrayText"; return getComputedStyle(probe).color; })(),
    };
  });
  assert.equal(forced.currentBg, forced.highlight, "forced colours: current page background");
  assert.equal(forced.currentFg, forced.highlightText, "forced colours: current page text");
  if (forced.disabled) assert.equal(forced.disabled, forced.grayText);
  await page.emulateMedia({ forcedColors: "none" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const motion = await page.evaluate(() => {
    document.body.replaceChildren();
    const paginator = window.paginator.createPaginator({ total: 100 });
    document.body.append(paginator.element);
    const style = getComputedStyle(paginator.element.querySelector(".mtrl-paginator__button"));
    // The shared base zeroes every transition under reduce
    return { reduce: style.transitionDuration, transition: style.transitionProperty };
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  assert.equal(motion.reduce, "0s", "reduced motion zeroes the state transition");
  assert.match(motion.transition, /background-color/, "the enabled transition is the state layer");

  // The four adapters: a move reports the pair, and a veto leaves the model
  for (const framework of ["react", "vue", "solid", "svelte"]) {
    const adapterPage = await browser.newPage();
    const adapterErrors = [];
    adapterPage.on("pageerror", (error) => adapterErrors.push(error.message));
    try {
      await adapterPage.goto(`${base}/test/browser/paginator-adapters.html?framework=${framework}`);
      try {
        await adapterPage.waitForFunction(() => !!document.querySelector("m-paginator")?.component, {}, { timeout: 15000 });
      } catch (error) {
        console.error(framework, "diagnostics:", adapterErrors, (await adapterPage.content()).slice(0, 300));
        throw error;
      }
      const next = adapterPage.locator("m-paginator").locator(".mtrl-paginator__button--next");
      await next.click();
      await adapterPage.waitForTimeout(50);
      assert.equal(await adapterPage.evaluate(() => document.querySelector("m-paginator").getAttribute("page")), "2", framework);
      await adapterPage.evaluate(() => { window.veto = true; });
      await next.click();
      await adapterPage.waitForTimeout(50);
      const state = await adapterPage.evaluate(() => ({
        page: document.querySelector("m-paginator").getAttribute("page"),
        events: window.events,
      }));
      assert.equal(state.page, "2", `${framework} veto keeps the page`);
      assert.deepEqual(state.events.at(-1), ["change", 3, 25, true], `${framework} cancelable change`);
      assert.deepEqual(adapterErrors, [], framework);
      console.log(`${framework}: paginator mounts, reports and vetoes`);
    } finally {
      await adapterPage.close();
    }
  }

  assert.deepEqual(errors, []);
  console.log("Paginator passes themes and direction, geometry, tab order, the cancelable change, forced colours, reduced motion and the four adapters.");
} finally {
  await browser?.close();
  await server.close();
}
