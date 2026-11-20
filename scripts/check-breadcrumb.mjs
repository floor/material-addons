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
        { value: "a", label: "Alpha", href: "#alpha" },
        { value: "b", label: "Bravo", href: "#bravo" },
        { value: "c", label: "Charlie", href: "#charlie" },
        { value: "d", label: "Delta", href: "#delta" },
        { value: "e", label: "Echo", href: "#echo" },
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
      // The menu renders its list when it opens, so the items are read below
      menu: [],
      visibleRows: [...crumb.element.querySelectorAll("ol > li:not(.mtrl-breadcrumb__item--overflow)")].filter((row) => !row.hidden).length,
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
    const button = crumb.element.querySelector(".mtrl-breadcrumb__overflow");
    const opened = {
      expanded: button.getAttribute("aria-expanded"),
      open: crumb.isOpen(),
      // material's menu renders in the top layer beside its opener
      menuInTopLayer: !!crumb.element.querySelector(".mtrl-menu") && crumb.element.querySelector(".mtrl-menu").matches(":popover-open"),
      focusInsideMenu: crumb.element.querySelector(".mtrl-menu")?.contains(document.activeElement) ?? false,
      menu: menuItems(),
    };
    (document.activeElement ?? crumb.element).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    const afterEscape = { open: crumb.isOpen(), expanded: button.getAttribute("aria-expanded") };
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
  assert.ok(collapse.opened.menu.length >= 2, "the middle items are menuitems");
  assert.equal(collapse.opened.menu.length + collapse.narrow.visibleRows, 6, "every item is either in the row or in the menu");
  assert.deepEqual(collapse.narrow.box, [48, 48], "the overflow target is 48x48");
  assert.equal(collapse.opened.expanded, "true");
  assert.equal(collapse.opened.open, true);
  assert.equal(collapse.opened.menuInTopLayer, true, "the menu shows in the top layer");
  assert.equal(collapse.afterEscape.open, false, "Escape closes the menu");
  assert.equal(collapse.afterEscape.expanded, "false");
  assert.equal(collapse.wide.hidden, true);
  assert.equal(collapse.wide.visible, 6, "a wide row shows every item again");

  // A pointer activation of a collapsed item navigates like its link, and
  // one Tab from the open menu closes it
  await reset();
  const menuInteraction = await page.evaluate(async () => {
    document.body.replaceChildren();
    const host = document.createElement("div");
    host.style.cssText = "width:260px";
    document.body.append(host);
    const crumb = window.breadcrumb.createBreadcrumb({
      items: [
        { value: "a", label: "Alpha", href: "#alpha" },
        { value: "b", label: "Bravo", href: "#bravo" },
        { value: "c", label: "Charlie", href: "#charlie" },
        { value: "d", label: "Delta", href: "#delta" },
        { value: "e", label: "Foxtrot" },
      ],
    });
    host.append(crumb.element);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const button = crumb.element.querySelector(".mtrl-breadcrumb__overflow");
    const before = window.location.hash;
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    const menuOpen = crumb.isOpen();
    const menu = crumb.element.querySelector(".mtrl-menu");
    const bravo = [...menu.querySelectorAll('[role="menuitem"]')].find((node) => node.textContent === "Bravo");
    bravo?.click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    return { before, after: window.location.hash, menuOpen, navigated: !!bravo, closed: !crumb.isOpen() };
  });
  assert.equal(menuInteraction.menuOpen, true, "the overflow opens material's menu");
  assert.equal(menuInteraction.navigated, true, "the collapsed item is a menuitem");
  assert.equal(menuInteraction.after, "#bravo", "a pointer activation navigates like its link");
  assert.equal(menuInteraction.closed, true, "selecting closes the menu");
  const secondTab = await page.evaluate(async () => {
    const button = document.querySelector(".mtrl-breadcrumb__overflow");
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    return { open: document.querySelector("m-breadcrumb, nav.mtrl-breadcrumb") !== null };
  });
  void secondTab;
  await page.keyboard.press("Tab");
  // The menu's exit transition runs before it leaves the screen
  await page.waitForTimeout(400);
  const afterTab = await page.evaluate(() => {
    const crumb = document.querySelector(".mtrl-breadcrumb");
    const button = crumb.querySelector(".mtrl-breadcrumb__overflow");
    const menu = crumb.querySelector(".mtrl-menu");
    const visible = menu ? getComputedStyle(menu).visibility === "visible" && menu.getBoundingClientRect().width > 0 : false;
    return { open: button.getAttribute("aria-expanded"), visible };
  });
  assert.equal(afterTab.open, "false", "one Tab closes the open menu");
  assert.equal(afterTab.visible, false, "and the menu is no longer shown");

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

  // The element's popup: the menu sheet is registered in its shadow root, so
  // the popup is styled and sits beside the button in both directions
  for (const direction of ["ltr", "rtl"]) {
    await reset();
    const popup = await page.evaluate(async (dir) => {
      document.documentElement.dir = dir;
      document.body.replaceChildren();
      const host = document.createElement("div");
      host.style.cssText = "width:260px";
      document.body.append(host);
      document.body.insertAdjacentHTML("beforeend", `<m-breadcrumb><m-breadcrumb-item value="a" href="#alpha">Alpha</m-breadcrumb-item><m-breadcrumb-item value="b" href="#bravo">Bravo</m-breadcrumb-item><m-breadcrumb-item value="c" href="#charlie">Charlie</m-breadcrumb-item><m-breadcrumb-item value="d" href="#delta">Delta</m-breadcrumb-item><m-breadcrumb-item value="e">Echo</m-breadcrumb-item></m-breadcrumb>`);
      window.breadcrumb.defineBreadcrumb();
      host.append(document.querySelector("m-breadcrumb"));
      await new Promise((resolve) => setTimeout(resolve, 200));
      const shadow = document.querySelector("m-breadcrumb").shadowRoot;
      const button = shadow.querySelector(".mtrl-breadcrumb__overflow");
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 300));
      const menu = shadow.querySelector(".mtrl-menu");
      if (!menu) return { styled: false };
      const style = getComputedStyle(menu);
      const box = menu.getBoundingClientRect();
      const anchor = button.getBoundingClientRect();
      return {
        styled: style.position === "fixed" && box.width > 0 && style.backgroundColor !== "rgba(0, 0, 0, 0)",
        anchored: Math.abs(box.top - anchor.bottom) <= 24 && box.left <= anchor.right + 8 && box.right >= anchor.left - 8,
        box: [box.left, box.top],
        anchor: [anchor.left, anchor.bottom],
      };
    }, direction);
    assert.equal(popup.styled, true, `${direction} element popup is styled`);
    assert.equal(popup.anchored, true, `${direction} element popup sits beside the button`);
  }
  await page.evaluate(() => { document.documentElement.dir = "ltr"; });

  // Forced colours: the popup keeps its border, in the factory and the element
  await reset();
  await page.emulateMedia({ forcedColors: "active" });
  const forcedBorders = await page.evaluate(async () => {
    document.body.replaceChildren();
    const host = document.createElement("div");
    host.style.cssText = "width:260px";
    document.body.append(host);
    const crumb = window.breadcrumb.createBreadcrumb({
      items: [
        { value: "a", label: "Alpha" }, { value: "b", label: "Bravo" }, { value: "c", label: "Charlie" },
        { value: "d", label: "Delta" }, { value: "e", label: "Echo" },
      ],
    });
    host.append(crumb.element);
    await new Promise((resolve) => setTimeout(resolve, 150));
    crumb.open();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const menu = crumb.element.querySelector(".mtrl-menu");
    const factory = menu ? getComputedStyle(menu).borderTopStyle : "none";
    crumb.close();
    document.body.replaceChildren();
    document.body.insertAdjacentHTML("beforeend", `<m-breadcrumb><m-breadcrumb-item value="a">Alpha</m-breadcrumb-item><m-breadcrumb-item value="b">Bravo</m-breadcrumb-item><m-breadcrumb-item value="c">Charlie</m-breadcrumb-item><m-breadcrumb-item value="d">Delta</m-breadcrumb-item><m-breadcrumb-item value="e">Echo</m-breadcrumb-item></m-breadcrumb>`);
    window.breadcrumb.defineBreadcrumb();
    const elementHost = document.querySelector("m-breadcrumb");
    elementHost.style.width = "260px";
    await new Promise((resolve) => setTimeout(resolve, 200));
    const shadow = elementHost.shadowRoot;
    shadow.querySelector(".mtrl-breadcrumb__overflow").click();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const elementMenu = shadow.querySelector(".mtrl-menu");
    const element = elementMenu ? getComputedStyle(elementMenu).borderTopStyle : "none";
    return { factory, element };
  });
  await page.emulateMedia({ forcedColors: "none" });
  assert.equal(forcedBorders.factory, "solid", "forced colours: factory popup keeps a border");
  assert.equal(forcedBorders.element, "solid", "forced colours: element popup keeps a border");

  // A disabled trail paints its links disabled: an anchor never matches :disabled
  await reset();
  const disabledTrail = await page.evaluate(() => {
    document.body.replaceChildren();
    const host = document.createElement("div");
    host.style.cssText = "width:600px";
    document.body.append(host);
    const crumb = window.breadcrumb.createBreadcrumb({
      items: [
        { value: "a", label: "Alpha", href: "#alpha" },
        { value: "b", label: "Bravo", href: "#bravo" },
        { value: "c", label: "Charlie" },
      ],
    });
    host.append(crumb.element);
    const link = crumb.element.querySelector("a.mtrl-breadcrumb__link");
    const enabled = getComputedStyle(link).color;
    crumb.disable();
    const disabled = getComputedStyle(crumb.element.querySelector("a.mtrl-breadcrumb__link")).color;
    return { enabled, disabled, cursor: getComputedStyle(crumb.element.querySelector("a.mtrl-breadcrumb__link")).cursor };
  });
  assert.notEqual(disabledTrail.disabled, disabledTrail.enabled, "a disabled trail paints its links disabled");
  assert.equal(disabledTrail.cursor, "default");

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
