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
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
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

  // Disclosure identity: two panels never share an id, and each button
  // controls its own region
  await reset();
  const identity = await page.evaluate(async () => {
    document.body.replaceChildren();
    const accordion = window.expansion.createAccordion({
      panels: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
    });
    document.body.append(accordion.element);
    const panels = accordion.getPanels();
    return {
      ids: panels.map((panel) => panel.header.id),
      regions: panels.map((panel) => panel.region.id),
      controlsResolve: panels.map((panel) => panel.header.getAttribute("aria-controls") === panel.region.id),
      labelledBy: panels.map((panel) => panel.region.getAttribute("aria-labelledby") === panel.header.id),
    };
  });
  assert.equal(new Set(identity.ids).size, 2, "header ids are unique");
  assert.equal(new Set(identity.regions).size, 2, "region ids are unique");
  assert.deepEqual(identity.controlsResolve, [true, true]);
  assert.deepEqual(identity.labelledBy, [true, true]);

  // One open panel, vetoes included; setValues holds the invariant too
  const coordination = await page.evaluate(async () => {
    document.body.replaceChildren();
    const accordion = window.expansion.createAccordion({
      panels: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
    });
    document.body.append(accordion.element);
    accordion.getPanel("a").open();
    const vetoClose = (event) => event.preventDefault();
    accordion.getPanel("a").on("beforeclose", vetoClose);
    accordion.getPanel("b").open();
    const vetoed = { a: accordion.getPanel("a").isOpen(), b: accordion.getPanel("b").isOpen(), values: accordion.getValues() };
    accordion.getPanel("a").off("beforeclose", vetoClose);
    accordion.getPanel("b").open();
    const after = accordion.getValues();
    accordion.setValues(["a", "b"]);
    const setValues = accordion.getValues();
    return { vetoed, after, setValues };
  });
  assert.deepEqual(coordination.vetoed, { a: true, b: false, values: ["a"] });
  assert.deepEqual(coordination.after, ["b"]);
  assert.deepEqual(coordination.setValues, ["a"]);

  // The element boundary: the authored value, two clicks, a later child, a
  // vetoed attribute and the open command
  await reset();
  const boundary = await page.evaluate(async () => {
    document.body.innerHTML = `<m-accordion value="b">
      <m-expansion-panel value="a" label="A"></m-expansion-panel>
      <m-expansion-panel value="b" label="B"></m-expansion-panel>
    </m-accordion>`;
    window.expansion.defineExpansionPanel();
    await new Promise((resolve) => setTimeout(resolve, 120));
    const accordion = document.querySelector("m-accordion");
    const initial = { value: accordion.value, open: accordion.component.getPanels().map((panel) => panel.isOpen()) };
    // Two header clicks in single-select mode leave one open
    const headers = accordion.component.getPanels().map((panel) => panel.header);
    headers[1].click();
    await new Promise((resolve) => setTimeout(resolve, 320));
    headers[0].click();
    await new Promise((resolve) => setTimeout(resolve, 320));
    const clicked = accordion.component.getValues();
    // ArrowDown reaches the next header inside the next panel's shadow root
    headers[0].focus();
    headers[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, composed: true, cancelable: true }));
    const deepActive = (() => {
      let active = document.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      return active;
    })();
    const arrowNext = deepActive === headers[1];
    // A later child is claimed and coordinates
    const extra = document.createElement("m-expansion-panel");
    extra.setAttribute("value", "c");
    extra.setAttribute("label", "C");
    accordion.append(extra);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const claimed = accordion.component.getPanels().length;
    extra.component.open();
    const afterExtra = accordion.component.getValues();
    // A vetoed opening leaves the host without the attribute
    const vetoPanel = accordion.component.getPanel("a");
    const vetoOpen = (event) => event.preventDefault();
    vetoPanel.on("beforeopen", vetoOpen);
    const panelA = document.querySelector("m-expansion-panel[value='a']");
    panelA.setAttribute("open", "");
    await new Promise((resolve) => setTimeout(resolve, 60));
    const vetoReflected = panelA.hasAttribute("open");
    vetoPanel.off("beforeopen", vetoOpen);
    panelA.openPanel();
    await new Promise((resolve) => setTimeout(resolve, 320));
    const forwarded = panelA.hasAttribute("open") && vetoPanel.isOpen();
    // A vetoed close keeps the attribute too
    const vetoClose = (event) => event.preventDefault();
    vetoPanel.on("beforeclose", vetoClose);
    panelA.removeAttribute("open");
    await new Promise((resolve) => setTimeout(resolve, 60));
    const closeReflected = panelA.hasAttribute("open") && vetoPanel.isOpen();
    vetoPanel.off("beforeclose", vetoClose);
    // The open event sees the shown region
    let seen = null;
    const eventPanel = accordion.component.getPanel("b");
    eventPanel.on("open", () => { seen = { hidden: eventPanel.region.hidden, inert: eventPanel.region.inert }; });
    eventPanel.open();
    await new Promise((resolve) => setTimeout(resolve, 60));
    return { initial, clicked, arrowNext, claimed, afterExtra, vetoReflected, forwarded, closeReflected, seen };
  });
  assert.deepEqual(boundary.initial, { value: "b", open: [false, true] });
  assert.deepEqual(boundary.clicked, ["a"]);
  assert.equal(boundary.arrowNext, true);
  assert.equal(boundary.claimed, 3);
  assert.deepEqual(boundary.afterExtra, ["c"]);
  assert.equal(boundary.vetoReflected, false);
  assert.equal(boundary.forwarded, true);
  assert.equal(boundary.closeReflected, true);
  assert.deepEqual(boundary.seen, { hidden: false, inert: false });

  // A vetoed switch opens nothing, openAll starts from a non-first panel,
  // and a removed child leaves the group
  await reset();
  const switching = await page.evaluate(async () => {
    document.body.innerHTML = `<m-accordion>
      <m-expansion-panel value="a" label="A"></m-expansion-panel>
      <m-expansion-panel value="b" label="B"></m-expansion-panel>
      <m-expansion-panel value="c" label="C"></m-expansion-panel>
    </m-accordion>`;
    window.expansion.defineExpansionPanel();
    await new Promise((resolve) => setTimeout(resolve, 120));
    const accordion = document.querySelector("m-accordion");
    const [a, b, c] = accordion.component.getPanels();
    a.open();
    const vetoClose = (event) => event.preventDefault();
    a.on("beforeclose", vetoClose);
    let opened = 0;
    b.on("open", () => { opened += 1; });
    b.header.click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    const vetoed = { opened, values: accordion.component.getValues(), b: b.isOpen() };
    a.off("beforeclose", vetoClose);
    // A veto on the destination's own opening leaves the current panel open
    const vetoOpen = (event) => event.preventDefault();
    c.on("beforeopen", vetoOpen);
    c.header.click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    const destination = { a: a.isOpen(), c: c.isOpen(), values: accordion.component.getValues() };
    c.off("beforeopen", vetoOpen);
    accordion.component.setValues([]);
    c.open();
    accordion.component.openAll();
    const openAll = accordion.component.getValues();
    // A rapid close reports the transition that settles, not the new state
    const after = [];
    a.on("afteropen", (event) => after.push(["afteropen", event.open]));
    a.on("afterclose", (event) => after.push(["afterclose", event.open]));
    a.open();
    a.close();
    await new Promise((resolve) => setTimeout(resolve, 400));
    document.querySelector("m-expansion-panel[value='c']").remove();
    await new Promise((resolve) => setTimeout(resolve, 120));
    return {
      vetoed, destination, openAll, after,
      panels: accordion.component.getPanels().length,
    };
  });
  assert.deepEqual(switching.vetoed, { opened: 0, values: ["a"], b: false });
  assert.deepEqual(switching.destination, { a: true, c: false, values: ["a"] });
  assert.deepEqual(switching.after, [["afteropen", true], ["afterclose", false]]);
  assert.deepEqual(switching.openAll, ["a"]);
  assert.equal(switching.panels, 2);

  // Two children that start open converge, even when the second vetoes its close
  await reset();
  const initial = await page.evaluate(async () => {
    document.body.innerHTML = `<m-accordion>
      <m-expansion-panel value="a" label="A" open></m-expansion-panel>
      <m-expansion-panel value="b" label="B" open></m-expansion-panel>
    </m-accordion>`;
    const second = document.querySelector("m-expansion-panel[value='b']");
    second.addEventListener("beforeclose", (event) => event.preventDefault());
    window.expansion.defineExpansionPanel();
    await new Promise((resolve) => setTimeout(resolve, 200));
    const accordion = document.querySelector("m-accordion");
    return { values: accordion.component.getValues(), a: accordion.component.getPanel("a").isOpen(), b: second.isOpen() };
  });
  assert.deepEqual(initial, { values: ["a"], a: true, b: false });

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
      const accordion = adapterPage.locator("m-accordion").first();
      assert.ok(await accordion.evaluate((node) => node.shadowRoot.adoptedStyleSheets.length > 0), framework);
      // A vetoed opening leaves the panel closed
      await adapterPage.evaluate(() => {
        const header = document.querySelector("m-expansion-panel").shadowRoot.querySelector(".mtrl-expansion-panel__header");
        header.click();
      });
      await adapterPage.waitForTimeout(340);
      assert.equal(await adapterPage.evaluate(() => document.querySelector("m-expansion-panel").isOpen()), false, framework);
      // The vetoed click left the bound model alone
      assert.equal(await adapterPage.evaluate(() => document.querySelector("output")?.textContent), "", `${framework} model unchanged by a veto`);
      await adapterPage.evaluate(() => { window.veto = false; });
      await adapterPage.evaluate(() => {
        const header = document.querySelector("m-expansion-panel").shadowRoot.querySelector(".mtrl-expansion-panel__header");
        header.click();
      });
      await adapterPage.waitForTimeout(340);
      assert.equal(await adapterPage.evaluate(() => document.querySelector("m-expansion-panel").isOpen()), true, framework);
      await adapterPage.waitForFunction(() => document.querySelector("output")?.textContent === "one");
      // ArrowDown reaches the next header through the panels' shadow roots
      const arrow = await adapterPage.evaluate(() => {
        const [first, second] = document.querySelector("m-accordion").component.getPanels().map((panel) => panel.header);
        first.focus();
        first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, composed: true, cancelable: true }));
        let active = document.activeElement;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        return active === second;
      });
      assert.equal(arrow, true, `${framework} ArrowDown reaches the next header`);
      // Single selection: opening the second panel closes the first, and the
      // bound model follows
      await adapterPage.evaluate(() => {
        const panel = document.querySelectorAll("m-expansion-panel")[1];
        panel.shadowRoot.querySelector(".mtrl-expansion-panel__header").click();
      });
      await adapterPage.waitForTimeout(340);
      assert.equal(
        await adapterPage.evaluate(() => document.querySelector("m-accordion").component.getValues().join(",")),
        "two",
        `${framework} keeps one panel open`,
      );
      await adapterPage.waitForFunction(() => document.querySelector("output")?.textContent === "two");
      // Multi-select keeps both panels open, whatever the framework's prop name
      const multi = await adapterPage.evaluate(async () => {
        const accordion = document.querySelectorAll("m-accordion")[1];
        for (let i = 0; i < 40 && !accordion.component?.getPanels().length; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        const panels = accordion.component.getPanels();
        panels[0].header.click();
        await new Promise((resolve) => setTimeout(resolve, 320));
        panels[1].header.click();
        await new Promise((resolve) => setTimeout(resolve, 320));
        return { multiSelect: accordion.multiSelect, values: accordion.component.getValues() };
      });
      assert.deepEqual(multi, { multiSelect: true, values: ["d", "e"] }, `${framework} multi-select`);
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
