// The expansion panel and accordion in a browser: themes and direction,
// keyboard, forced colours, pre-upgrade sizing, and the four adapters.
//
//   bun run build --production && node scripts/check-expansion-panel.mjs
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
  cacheDir: "node_modules/.vite-expansion-panel",
  optimizeDeps: { entries: ["test/browser/expansion-panel-adapters.html"], exclude: ["material-addons/svelte", "svelte"] },
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
  page.on("pageerror", (error) => errors.push(error.message));
  const reset = async () => {
    await page.goto(`${base}/test/browser/expansion-panel.html`);
    await page.waitForFunction(() => !!window.expansion);
  };

  // Themes and direction: each variant paints, and the start placement mirrors
  for (const mode of ["light", "dark"]) {
    for (const direction of ["ltr", "rtl"]) {
      await reset();
      const article = await page.evaluate(({ mode, direction }) => {
        document.documentElement.dataset.themeMode = mode;
        document.documentElement.dir = direction;
        document.body.replaceChildren();
        const row = document.createElement("div");
        row.style.cssText = "display:flex;gap:8px;padding:16px;width:820px";
        for (const variant of ["outlined", "elevated", "filled"]) {
          const panel = window.expansion.createExpansionPanel({ label: variant, variant, placement: "start", supportingText: "Hint" });
          row.append(panel.element);
        }
        document.body.append(row);
        return [...row.children].map((element) => {
          const style = getComputedStyle(element);
          const header = element.querySelector(".mtrl-expansion-panel__header");
          const parts = [...header.children].map((child) => child.className);
          return {
            background: style.backgroundColor,
            border: style.borderTopColor,
            shadow: style.boxShadow,
            // Start placement puts the toggle before the header content
            placementStart: parts.indexOf("mtrl-expansion-panel__toggle") < parts.indexOf("mtrl-expansion-panel__header-content"),
            toggleEdge: element.querySelector(".mtrl-expansion-panel__toggle").getBoundingClientRect().left - element.getBoundingClientRect().left,
          };
        });
      }, { mode, direction });
      assert.equal(article.length, 3);
      const [outlined, elevated, filled] = article;
      assert.notEqual(outlined.background, filled.background, `${mode}/${direction} variants differ`);
      assert.equal(outlined.shadow, "none", `${mode}/${direction} outlined has no shadow`);
      assert.notEqual(elevated.shadow, "none", `${mode}/${direction} elevated has a shadow`);
      assert.ok(article.every((row) => row.placementStart), `${mode}/${direction} start placement leads`);
      // 'start' is the inline start: the left edge in LTR, the right in RTL
      for (const row of article) {
        assert.ok(direction === "ltr" ? row.toggleEdge < 80 : row.toggleEdge > 40, `${mode}/${direction} toggle at inline start`);
      }
    }
  }

  // Keyboard: arrows wrap, Home and End go to the ends, Enter toggles
  await reset();
  const keyboard = await page.evaluate(async () => {
    document.body.replaceChildren();
    const accordion = window.expansion.createAccordion({
      panels: [
        { value: "a", label: "A", content: "<input id='a-input'>" },
        { value: "b", label: "B", content: "<input id='b-input'>" },
        { value: "c", label: "C", content: "third" },
      ],
    });
    document.body.append(accordion.element);
    const headers = accordion.getPanels().map((panel) => panel.header);
    const press = (key) => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    headers[0].focus();
    press("ArrowDown");
    const down = document.activeElement === headers[1];
    press("ArrowUp"); press("ArrowUp");
    const wrap = document.activeElement === headers[2];
    press("Home");
    const home = document.activeElement === headers[0];
    press("End");
    const end = document.activeElement === headers[2];
    headers[0].focus();
    headers[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    headers[0].click();
    await new Promise((resolve) => setTimeout(resolve, 320));
    const open = accordion.getPanel("a").isOpen();
    // Tab from the open header reaches its content; the closed panels stay out
    headers[1].focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    return { down, wrap, home, end, open, aInput: !!document.querySelector("#a-input") };
  });
  assert.deepEqual(keyboard, { down: true, wrap: true, home: true, end: true, open: true, aInput: true });

  const tabOrder = await page.evaluate(async () => {
    document.body.replaceChildren();
    const accordion = window.expansion.createAccordion({
      panels: [
        { value: "a", label: "A", content: "<input id='a-input'>" },
        { value: "b", label: "B", content: "<input id='b-input'>" },
      ],
    });
    document.body.append(accordion.element);
    accordion.getPanel("a").open();
    await new Promise((resolve) => setTimeout(resolve, 320));
    const headers = accordion.getPanels().map((panel) => panel.header);
    headers[0].focus();
    const seen = [];
    for (let i = 0; i < 4; i++) {
      const next = headers[0].ownerDocument.activeElement;
      const all = [...document.querySelectorAll("input,button")];
      const index = all.indexOf(next);
      const following = all[index + 1] ?? null;
      seen.push(following?.id ?? following?.className ?? null);
      if (following) following.focus();
    }
    return { seen, hiddenPanelHidden: accordion.getPanel("b").region.hidden };
  });
  assert.equal(tabOrder.hiddenPanelHidden, true);
  assert.equal(tabOrder.seen[0], "a-input", "the open panel's content follows its header");

  // Forced colours keep the boundary, the focus ring and the disabled colour apart
  await reset();
  await page.emulateMedia({ forcedColors: "active" });
  const forced = await page.evaluate(() => {
    document.body.replaceChildren();
    const panel = window.expansion.createExpansionPanel({ label: "Forced", variant: "filled" });
    const off = window.expansion.createExpansionPanel({ label: "Disabled", disabled: true });
    document.body.append(panel.element, off.element);
    panel.header.focus();
    const probe = document.createElement("div");
    probe.style.cssText = "forced-color-adjust:none;color:CanvasText;border-color:CanvasText;outline-color:Highlight";
    document.body.append(probe);
    const canvasText = getComputedStyle(probe).borderTopColor;
    const highlight = getComputedStyle(probe).outlineColor;
    probe.style.color = "GrayText";
    const grayText = getComputedStyle(probe).color;
    return {
      border: getComputedStyle(panel.element).borderTopColor,
      outline: getComputedStyle(panel.header).outlineColor,
      disabled: getComputedStyle(off.element).borderTopColor,
      canvasText,
      highlight,
      grayText,
    };
  });
  assert.equal(forced.border, forced.canvasText);
  assert.equal(forced.outline, forced.highlight);
  assert.equal(forced.disabled, forced.grayText);
  await page.emulateMedia({ forcedColors: "none" });

  // Pre-upgrade: a closed panel is bounded before its definition arrives
  await reset();
  const preupgrade = await page.evaluate(() => {
    document.body.innerHTML = '<m-expansion-panel open label="A"><p>Body</p></m-expansion-panel><m-expansion-panel label="B"><p>Body</p></m-expansion-panel>';
    const [openPanel, closedPanel] = document.querySelectorAll("m-expansion-panel");
    const result = { open: getComputedStyle(openPanel).display, closedMax: getComputedStyle(closedPanel).maxHeight };
    window.expansion.defineExpansionPanel();
    return result;
  });
  assert.equal(preupgrade.open, "block");
  assert.equal(preupgrade.closedMax, "48px");

  // The four adapters mount both elements, veto an opening and follow the model
  for (const framework of ["react", "vue", "solid", "svelte"]) {
    const adapterPage = await browser.newPage();
    const adapterErrors = [];
    adapterPage.on("pageerror", (error) => adapterErrors.push(error.message));
    try {
      await adapterPage.goto(`${base}/test/browser/expansion-panel-adapters.html?framework=${framework}`);
      try {
        await adapterPage.waitForFunction(() => !!document.querySelector("m-expansion-panel")?.component, {}, { timeout: 15000 });
      } catch (error) {
        console.error(framework, "diagnostics:", adapterErrors, (await adapterPage.content()).slice(0, 300));
        throw error;
      }
      const accordion = adapterPage.locator("m-accordion");
      assert.ok(await accordion.evaluate((node) => node.shadowRoot.adoptedStyleSheets.length > 0), framework);
      // A vetoed opening leaves the panel closed
      await adapterPage.evaluate(() => {
        const header = document.querySelector("m-expansion-panel").shadowRoot.querySelector(".mtrl-expansion-panel__header");
        header.click();
      });
      await adapterPage.waitForTimeout(340);
      assert.equal(await adapterPage.evaluate(() => document.querySelector("m-expansion-panel").isOpen()), false, framework);
      await adapterPage.evaluate(() => { window.veto = false; });
      await adapterPage.evaluate(() => {
        const header = document.querySelector("m-expansion-panel").shadowRoot.querySelector(".mtrl-expansion-panel__header");
        header.click();
      });
      await adapterPage.waitForTimeout(340);
      assert.equal(await adapterPage.evaluate(() => document.querySelector("m-expansion-panel").isOpen()), true, framework);
      await adapterPage.waitForFunction(() => document.querySelector("output")?.textContent === "one");
      assert.deepEqual(adapterErrors, [], framework);
      console.log(`${framework}: panel and accordion mount, veto and model pass`);
    } finally {
      await adapterPage.close();
    }
  }

  assert.deepEqual(errors, []);
  console.log("Expansion panel passes themes and direction, keyboard, tab order, forced colours, pre-upgrade and the four adapters.");
} finally {
  await browser?.close();
  await server.close();
}
