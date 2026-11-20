// The breadcrumb in a browser: themes and direction, the overflow collapse
// and its menu, forced colours, reduced motion, and the four adapters.
//
//   bun run build --production && node scripts/check-breadcrumb.mjs
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
  cacheDir: "node_modules/.vite-breadcrumb",
  optimizeDeps: { entries: ["test/browser/breadcrumb-adapters.html"], exclude: ["material-addons/svelte", "svelte"] },
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
    await page.goto(`${base}/test/browser/breadcrumb.html`);
    await page.waitForFunction(() => !!window.breadcrumb);
  };

  // Themes and direction: the current page is marked and the chevrons mirror
  for (const mode of ["light", "dark"]) {
    for (const direction of ["ltr", "rtl"]) {
      await reset();
      const look = await page.evaluate(({ mode, direction }) => {
        document.documentElement.dataset.themeMode = mode;
        document.documentElement.dir = direction;
        document.body.replaceChildren();
        const crumb = window.breadcrumb.createBreadcrumb({
          items: [
            { value: "home", label: "Home", href: "#home" },
            { value: "rooms", label: "Rooms", href: "#rooms" },
            { value: "chair", label: "Chair" },
          ],
        });
        document.body.append(crumb.element);
        const separator = crumb.element.querySelector(".mtrl-breadcrumb__separator svg");
        const current = crumb.element.querySelector('[aria-current="page"]');
        return {
          separators: crumb.element.querySelectorAll("li:not(.mtrl-breadcrumb__item--overflow) .mtrl-breadcrumb__separator").length,
          current: current?.textContent,
          currentColor: getComputedStyle(current).color,
          linkColor: getComputedStyle(crumb.element.querySelector(".mtrl-breadcrumb__link")).color,
          mirrored: getComputedStyle(separator).transform !== "none",
        };
      }, { mode, direction });
      assert.equal(look.separators, 2, `${mode}/${direction} separators`);
      assert.equal(look.current, "Chair", `${mode}/${direction} current`);
      assert.notEqual(look.currentColor, look.linkColor, `${mode}/${direction} current differs from a link`);
      assert.equal(look.mirrored, direction === "rtl", `${mode}/${direction} chevron mirrors`);
    }
  }

  // The collapse: narrow folds the middle into the menu and wide restores it
  await reset();
  const collapse = await page.evaluate(async () => {
    document.body.replaceChildren();
    const host = document.createElement("div");
    host.style.cssText = "width:260px";
    document.body.append(host);
    const crumb = window.breadcrumb.createBreadcrumb({
      items: [
        { value: "a", label: "Alpha" },
        { value: "b", label: "Bravo" },
        { value: "c", label: "Charlie" },
        { value: "d", label: "Delta" },
        { value: "e", label: "Echo" },
        { value: "f", label: "Foxtrot" },
      ],
    });
    host.append(crumb.element);
    // The collapse runs on a ResizeObserver, after the first layout
    await new Promise((resolve) => setTimeout(resolve, 120));
    const overflow = crumb.element.querySelector(".mtrl-breadcrumb__item--overflow");
    const menuItems = () => [...crumb.element.querySelectorAll('[role="menuitem"]')].map((node) => node.textContent);
    const narrow = {
      // The overflow item lives inside the list, right after the first item
      placed: overflow.parentElement === crumb.element.querySelector("ol")
        && [...overflow.parentElement.children].indexOf(overflow) === 1,
      fits: crumb.element.querySelector("ol").scrollWidth <= host.clientWidth + 1,
      visible: menuItems().length + 2,
      menu: menuItems(),
      // A collapsed row leaves the row: the display rule may not paint it
      leftTheRow: [...crumb.element.querySelectorAll("ol > li")].every((row) => {
        if (!row.hasAttribute("hidden")) return true;
        const box = row.getBoundingClientRect();
        return getComputedStyle(row).display === "none" && box.width === 0 && box.height === 0;
      }),
      expanded: crumb.element.querySelector(".mtrl-breadcrumb__overflow").getAttribute("aria-expanded"),
      box: (() => {
        const box = crumb.element.querySelector(".mtrl-breadcrumb__overflow").getBoundingClientRect();
        return [box.width, box.height];
      })(),
    };
    crumb.open();
    const opened = {
      expanded: crumb.element.querySelector(".mtrl-breadcrumb__overflow").getAttribute("aria-expanded"),
      focus: document.activeElement?.textContent,
      menuHidden: crumb.element.querySelector(".mtrl-breadcrumb__menu").hidden,
    };
    (document.activeElement ?? crumb.element).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const afterEscape = { open: crumb.isOpen(), focus: document.activeElement?.className };
    host.style.width = "900px";
    await new Promise((resolve) => setTimeout(resolve, 120));
    const wide = {
      hidden: crumb.element.querySelector(".mtrl-breadcrumb__item--overflow") === null,
      visible: [...crumb.element.querySelectorAll("li:not(.mtrl-breadcrumb__item--overflow)")].filter((row) => !row.hidden).length,
    };
    return { narrow, opened, afterEscape, wide };
  });
  assert.equal(collapse.narrow.placed, true, "the overflow item sits inside the list after the first item");
  assert.equal(collapse.narrow.fits, true, "the collapsed row, overflow button included, fits");
  assert.equal(collapse.narrow.leftTheRow, true, "collapsed items leave the row instead of only moving");
  assert.equal(collapse.narrow.expanded, "false");
  assert.ok(collapse.narrow.menu.length >= 2, "the middle items are menuitems");
  assert.equal(collapse.narrow.menu.length, collapse.narrow.visible - 2, "collapsed plus first and current are the trail");
  assert.deepEqual(collapse.narrow.box, [48, 48], "the overflow target is 48x48");
  assert.equal(collapse.opened.expanded, "true");
  assert.equal(collapse.opened.menuHidden, false);
  assert.ok(collapse.opened.focus, "opening focuses a menuitem");
  assert.equal(collapse.afterEscape.open, false);
  assert.equal(collapse.afterEscape.focus, "mtrl-breadcrumb__overflow", "Escape returns focus to the overflow button");
  assert.equal(collapse.wide.hidden, true);
  assert.equal(collapse.wide.visible, 6, "a wide row shows every item again");

  // Tab out of the open menu closes it, and focus follows the tab
  await reset();
  const tabOut = await page.evaluate(async () => {
    document.body.replaceChildren();
    const host = document.createElement("div");
    host.style.cssText = "width:180px";
    document.body.append(host);
    const crumb = window.breadcrumb.createBreadcrumb({
      items: ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"].map((label, index) => ({ value: `v${index}`, label })),
    });
    host.append(crumb.element);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const overflow = crumb.element.querySelector(".mtrl-breadcrumb__item--overflow");
    const button = overflow.querySelector(".mtrl-breadcrumb__overflow");
    button.click();
    const open = crumb.isOpen();
    // Tab from the focused menuitem leaves the overflow
    (document.activeElement ?? button).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    document.activeElement?.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: document.body }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    return {
      open,
      closed: !crumb.isOpen(),
      expanded: button.getAttribute("aria-expanded"),
      hidden: crumb.element.querySelector(".mtrl-breadcrumb__menu").hidden,
      focusStays: document.activeElement === button,
    };
  });
  assert.equal(tabOut.open, true);
  assert.equal(tabOut.closed, true, "focus leaving the menu closes it");
  assert.equal(tabOut.expanded, "false");
  assert.equal(tabOut.hidden, true);
  assert.equal(tabOut.focusStays, false, "it does not pull focus back to the button");

  // The button's own width counts: a row that fits without it overflows once
  // it has to be shown
  await reset();
  const tipping = await page.evaluate(async () => {
    document.body.replaceChildren();
    const host = document.createElement("div");
    document.body.append(host);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 120));
    // A two-item row has no overflow button: its width is the natural fit
    const measure = async (labels, width) => {
      if (width !== undefined) host.style.width = `${width}px`;
      host.replaceChildren();
      const crumb = window.breadcrumb.createBreadcrumb({
        items: labels.map((label, index) => ({ value: `v${index}`, label })),
      });
      host.append(crumb.element);
      await settle();
      const list = crumb.element.querySelector("ol");
      const overflow = crumb.element.querySelector(".mtrl-breadcrumb__item--overflow");
      return {
        overflow: overflow !== null,
        fits: list.scrollWidth <= host.clientWidth + 1,
        scroll: list.scrollWidth,
        client: host.clientWidth,
        placed: overflow ? overflow.parentElement === list && [...list.children].indexOf(overflow) === 1 : null,
      };
    };
    const labels = ["Alpha", "Bravo", "Charlie", "Omega"];
    // Fold the row as far as it goes: what remains is first, the button and
    // the current item, and its width is the folded row's
    const folded = await measure(labels, 60);
    const foldedWidth = folded.scroll;
    // Ten pixels either side of that width: with room the folded row fits,
    // without it the row scrolls rather than pretending the button is free
    const roomy = await measure(labels, foldedWidth + 10);
    const tipped = await measure(labels, foldedWidth - 10);
    return { foldedWidth, roomy, tipped };
  });
  assert.equal(tipping.roomy.overflow, true, "the folded row shows the overflow button");
  assert.equal(tipping.roomy.fits, true, "with room for the button the folded row fits");
  assert.equal(tipping.roomy.placed, true, "the button is inside the list");
  assert.equal(tipping.tipped.overflow, true, "without room for the button the row still offers it");
  assert.equal(tipping.tipped.fits, false, "the button's width is counted, so this row scrolls");
  assert.ok(tipping.tipped.scroll > tipping.tipped.client, "the overflow is visible instead of ignored");

  // Forced colours and reduced motion
  await reset();
  await page.emulateMedia({ forcedColors: "active" });
  const forced = await page.evaluate(() => {
    document.body.replaceChildren();
    const crumb = window.breadcrumb.createBreadcrumb({
      items: [
        { value: "home", label: "Home", href: "#home" },
        { value: "rooms", label: "Rooms", disabled: true },
        { value: "chair", label: "Chair" },
      ],
    });
    document.body.append(crumb.element);
    // The browser's own forced colours for the roles, sampled the same way
    const anchor = document.createElement("a");
    anchor.href = "#";
    anchor.textContent = "probe";
    const text = document.createElement("span");
    text.textContent = "probe";
    document.body.append(anchor, text);
    return {
      link: getComputedStyle(crumb.element.querySelector("a.mtrl-breadcrumb__link")).color,
      anchor: getComputedStyle(anchor).color,
      current: getComputedStyle(crumb.element.querySelector(".mtrl-breadcrumb__current")).color,
      text: getComputedStyle(text).color,
      disabled: getComputedStyle(crumb.element.querySelector("button.mtrl-breadcrumb__link")).color,
    };
  });
  assert.equal(forced.link, forced.anchor, "forced colours: link uses LinkText");
  assert.equal(forced.current, forced.text, "forced colours: current uses CanvasText");
  assert.notEqual(forced.disabled, forced.link, "forced colours: disabled uses GrayText, not LinkText");
  await page.emulateMedia({ forcedColors: "none" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const motion = await page.evaluate(() => {
    document.body.replaceChildren();
    const crumb = window.breadcrumb.createBreadcrumb({
      items: [{ value: "home", label: "Home", href: "#home" }, { value: "chair", label: "Chair" }],
    });
    document.body.append(crumb.element);
    const style = getComputedStyle(crumb.element.querySelector(".mtrl-breadcrumb__link"));
    return { duration: style.transitionDuration, transition: style.transitionProperty };
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  assert.equal(motion.duration, "0s", "reduced motion zeroes the state transition");
  assert.match(motion.transition, /background-color/, "the enabled transition is the state layer");

  // The four adapters: an ancestor reports the pair, and a veto stops it
  for (const framework of ["react", "vue", "solid", "svelte"]) {
    const adapterPage = await browser.newPage();
    const adapterErrors = [];
    adapterPage.on("pageerror", (error) => adapterErrors.push(error.message));
    try {
      await adapterPage.goto(`${base}/test/browser/breadcrumb-adapters.html?framework=${framework}`);
      try {
        await adapterPage.waitForFunction(() => !!document.querySelector("m-breadcrumb")?.component, {}, { timeout: 15000 });
      } catch (error) {
        console.error(framework, "diagnostics:", adapterErrors, (await adapterPage.content()).slice(0, 300));
        throw error;
      }
      const first = adapterPage.locator("m-breadcrumb").locator("li button").first();
      await first.click();
      await adapterPage.waitForTimeout(50);
      const moved = await adapterPage.evaluate(() => window.events.slice());
      assert.deepEqual(moved[0], ["beforechange", "home", "chair"], `${framework} beforechange`);
      assert.deepEqual(moved[1], ["change", "home", "chair"], `${framework} change`);
      await adapterPage.evaluate(() => { window.veto = true; });
      await first.click();
      await adapterPage.waitForTimeout(50);
      const vetoed = await adapterPage.evaluate(() => window.events.slice(2));
      assert.deepEqual(vetoed, [["beforechange", "home", "chair"]], `${framework} veto reports nothing further`);
      assert.deepEqual(adapterErrors, [], framework);
      console.log(`${framework}: breadcrumb mounts, reports and vetoes`);
    } finally {
      await adapterPage.close();
    }
  }

  assert.deepEqual(errors, []);
  console.log("Breadcrumb passes themes and direction, the overflow collapse and menu, forced colours, reduced motion and the four adapters.");
} finally {
  await browser?.close();
  await server.close();
}
