import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { compile } from "svelte/compiler";
import { createServer } from "vite";
import { renderNavigationTabs } from "material-addons/components/navigation-tabs";
import { MATERIAL_DEPS } from "./vite-deps.mjs";

const fixture = "test/browser/navigation-tabs.html";
const markup = renderNavigationTabs("Documentation pages", [
  { href: "#overview", label: "Overview", current: true },
  { href: "#matrix", label: "Matrix" },
]);
const server = await createServer({
  configFile: false,
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  resolve: { conditions: ["svelte", "module", "browser", "development"] },
  cacheDir: "node_modules/.vite-navigation-tabs",
  optimizeDeps: {
    include: [...MATERIAL_DEPS, "material/components/drawer"],
    entries: [fixture],
    exclude: ["material-addons/svelte", "svelte"],
  },
  server: { host: "127.0.0.1", port: 0, hmr: false },
  plugins: [{
    name: "navigation-tabs-fixture",
    transformIndexHtml(html) {
      return html.replace("<!-- navigation tabs render here -->", markup);
    },
    transform(source, filename) {
      if (filename.endsWith(".svelte")) return compile(source, { filename, generate: "client" }).js;
    },
  }],
});

const read = (indicator) => indicator.evaluate(node => {
  const pill = getComputedStyle(node, "::before");
  return {
    height: node.getBoundingClientRect().height,
    radius: pill.borderRadius,
    color: pill.backgroundColor,
    scale: new DOMMatrix(pill.transform).a,
    opacity: Number(getComputedStyle(node, "::after").opacity),
  };
});

const waitForOpacity = (indicator, opacity) => indicator.evaluate(async (node, opacity) => {
  const end = performance.now() + 2000;
  while (Number(getComputedStyle(node, "::after").opacity) !== opacity) {
    if (performance.now() > end) {
      const target = node.parentElement;
      throw new Error(`${target.textContent.trim()}: state layer was ${getComputedStyle(node, "::after").opacity}, expected ${opacity} (focus: ${target.matches(":focus-visible")}, active: ${target.matches(":active")})`);
    }
    await new Promise(requestAnimationFrame);
  }
}, opacity);

const press = async (page, target, inspect) => {
  await target.hover();
  await page.mouse.down();
  try {
    await inspect();
  } finally {
    await page.mouse.up();
    await page.mouse.move(1000, 4);
  }
};

try {
  await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}/${fixture}`;

  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      const noJS = await browser.newPage({ javaScriptEnabled: false });
      await noJS.goto(url);
      const staticNav = noJS.getByRole("navigation", { name: "Documentation pages" });
      assert.equal(await staticNav.getByRole("link", { name: "Overview" }).getAttribute("aria-current"), "page");
      await staticNav.getByRole("link", { name: "Matrix" }).click();
      assert.equal(new URL(noJS.url()).hash, "#matrix");
      await noJS.close();

      const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
      page.setDefaultTimeout(7000);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(url);
      await page.waitForFunction(() => window.adopted);
      const nav = page.getByRole("navigation", { name: "Documentation pages" });
      const overview = nav.getByRole("link", { name: "Overview" });
      const matrix = nav.getByRole("link", { name: "Matrix" });
      const matrixIndicator = matrix.locator(".mtrl-navigation-tabs__indicator");
      const drawer = page.locator('#drawer-layers [data-id="home"]');
      const drawerIndicator = drawer.locator(".mtrl-drawer__active-indicator");
      const drawerRest = await read(drawerIndicator);
      const start = await read(matrixIndicator);
      assert.equal(start.height, 56);
      assert.deepEqual(start, drawerRest);
      assert.equal(start.scale, 0.32);
      assert.equal(await nav.getByRole("tab").count(), 0);

      const sampled = await matrixIndicator.evaluate(async node => {
        const scale = () => new DOMMatrix(getComputedStyle(node, "::before").transform).a;
        const initial = scale();
        window.tabs.setCurrent("#matrix");
        const samples = [];
        const deadline = performance.now() + 2500;
        do {
          await new Promise(requestAnimationFrame);
          samples.push(scale());
          const running = node.getAnimations().some(animation => animation.playState === "running");
          if (samples.length >= 3 && !running && samples.at(-1) === 1) break;
        } while (performance.now() < deadline);
        return { initial, samples };
      });
      assert.equal(sampled.initial, 0.32);
      assert.ok(sampled.samples.some(scale => scale > 0.32 && scale < 1), sampled.samples.join(", "));
      assert.equal(sampled.samples.at(-1), 1);
      assert.equal(await matrix.getAttribute("aria-current"), "page");
      assert.equal(await overview.getAttribute("aria-current"), null);
      assert.equal((await read(page.locator('#drawer-layers [data-id="active"] .mtrl-drawer__active-indicator'))).scale, 1);

      const tab = engine === webkit && process.platform === "darwin" ? "Alt+Tab" : "Tab";
      await page.locator("#before").focus();
      await page.keyboard.press(tab);
      assert.equal(await overview.evaluate(node => document.activeElement === node), true);
      await page.keyboard.press("ArrowRight");
      assert.equal(await overview.evaluate(node => document.activeElement === node), true);
      await waitForOpacity(overview.locator(".mtrl-navigation-tabs__indicator"), 0.1);
      await page.keyboard.press(tab);
      assert.equal(await matrix.evaluate(node => document.activeElement === node), true);
      await page.keyboard.press("Enter");
      assert.equal(new URL(page.url()).hash, "#matrix");
      await page.keyboard.press(tab);
      assert.equal(await page.locator("#after").evaluate(node => document.activeElement === node), true);

      const plain = page.getByRole("link", { name: "Plain" });
      const plainIndicator = plain.locator(".mtrl-navigation-tabs__indicator");
      for (const [target, indicator] of [[plain, plainIndicator], [drawer, drawerIndicator]]) {
        await page.keyboard.press(tab);
        await target.focus();
        await waitForOpacity(indicator, 0.1);
        await page.locator("#before").focus();
        await target.hover();
        await waitForOpacity(indicator, 0.08);
        await press(page, target, () => waitForOpacity(indicator, 0.1));
      }

      await page.emulateMedia({ reducedMotion: "reduce" });
      const wave = (link) => link.locator(".mtrl-ripple-wave.active").evaluate(node => {
        const style = getComputedStyle(node);
        const container = getComputedStyle(node.parentElement);
        return { opacity: Number(style.opacity), position: container.position, clipping: container.overflow };
      });
      await press(page, overview, async () => {
        const drawerRipple = page.locator('#drawer-ripple [data-id="home"]');
        await drawerRipple.dispatchEvent("pointerdown", { pointerType: "mouse", clientX: 20, clientY: 20 });
        const pressLayer = await wave(overview);
        assert.equal(pressLayer.opacity, 0.1);
        assert.deepEqual(pressLayer, await wave(drawerRipple));
        await waitForOpacity(overview.locator(".mtrl-navigation-tabs__indicator"), 0);
      });

      const element = page.locator("#element");
      await element.getByRole("navigation", { name: "Element navigation" }).waitFor();
      assert.equal(await element.getByRole("link", { name: "Matrix" }).getAttribute("aria-current"), "page");
      const sticky = await element.evaluate(node => {
        node.style.setProperty("--mtrl-navigation-tabs-sticky-offset", "12px");
        return [getComputedStyle(node).position, getComputedStyle(node).top];
      });
      assert.deepEqual(sticky, ["sticky", "12px"]);
      const changed = await element.evaluate(node => {
        const link = node.shadowRoot.querySelector("a");
        const changes = [];
        node.addEventListener("change", event => changes.push(event.detail.href), { once: true });
        node.setCurrent("#overview");
        return { changes, sameLink: node.shadowRoot.querySelector("a") === link, current: node.getCurrent() };
      });
      assert.deepEqual(changed, { changes: ["#overview"], sameLink: true, current: "#overview" });
      await element.evaluate(node => {
        const link = document.createElement("a");
        link.href = "#develop";
        link.textContent = "Develop";
        node.append(link);
      });
      await element.getByRole("link", { name: "Develop" }).waitFor();
      assert.deepEqual(errors, []);
      console.log(`${engine.name()}: SSR links, pill, state layers, Material ripple, keyboard order and custom element passed`);

      for (const framework of ["react", "vue", "solid", "svelte"]) {
        await page.goto(`${url}?framework=${framework}`);
        const adapter = page.getByRole("navigation", { name: "Adapter navigation" });
        await adapter.waitFor();
        assert.equal(await adapter.getByRole("link", { name: "Overview" }).getAttribute("aria-current"), "page");
        const host = page.locator("m-navigation-tabs");
        await host.evaluate(node => node.setAttribute("current", "#matrix"));
        assert.equal(await adapter.getByRole("link", { name: "Matrix" }).getAttribute("aria-current"), "page");
        await host.evaluate(node => node.setCurrent("#overview"));
        assert.deepEqual(await page.evaluate(() => window.adapterChanges), ["#overview"]);
      }
      assert.deepEqual(errors, []);
      console.log(`${engine.name()}: React, Vue, Solid and Svelte navigation tabs passed`);
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}
