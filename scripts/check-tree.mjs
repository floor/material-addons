// The tree's browser behaviour that jsdom cannot prove: the tokens in light
// and dark, RTL indent and toggle placement, the keyboard map, forced
// colours, reduced motion, pre-upgrade hiding, the row heights, and the
// element reading <m-tree-item> declarations.
//
//   bun run build --production && node scripts/check-tree.mjs
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tree",
  optimizeDeps: { entries: ["test/browser/tree.html"] },
  server: { host: "127.0.0.1", port: 0, hmr: false },
});

let browser;
try {
  await server.listen();
  const { port } = server.httpServer.address();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.text().startsWith("DBG")) console.log(message.text().slice(0, 200)); });
  const reset = async (options = {}) => {
    const query = options.virtual ? "?virtual" : "";
    await page.goto(`http://127.0.0.1:${port}/test/browser/tree.html${query}`, { waitUntil: "networkidle" });
    await page.evaluate((opts) => {
      document.documentElement.dir = opts.dir ?? "ltr";
      if (opts.dark) document.documentElement.setAttribute("data-theme-mode", "dark");
      else document.documentElement.removeAttribute("data-theme-mode");
    }, options);
    await page.waitForFunction(() => !!window.tree);
  };

  const NODES = [
    { value: "src", label: "src", children: [{ value: "tree", label: "tree.ts" }] },
    { value: "readme", label: "README", supportingText: "Notes" },
  ];

  // Light and dark: label and supporting text resolve from the tokens.
  const fills = {};
  for (const mode of ["light", "dark"]) {
    await reset({ dark: mode === "dark" });
    const out = await page.evaluate((nodes) => {
      const tree = window.tree.createTree({ nodes, expanded: ["src"] });
      document.body.append(tree.element);
      const label = tree.element.querySelector('[data-value="readme"] .mtrl-tree__label');
      const supporting = tree.element.querySelector('[data-value="readme"] .mtrl-tree__supporting-text');
      return {
        label: getComputedStyle(label).color,
        supporting: getComputedStyle(supporting).color,
        rowHeight: getComputedStyle(tree.element.querySelector('[data-value="readme"] .mtrl-tree__row')).height,
      };
    }, NODES);
    assert.notEqual(out.label, out.supporting, `${mode}: the two text roles differ`);
    fills[mode] = out;
    await page.evaluate(() => { document.body.innerHTML = ""; });
  }
  assert.notEqual(fills.light.label, fills.dark.label, "the label follows the theme");
  assert.equal(fills.light.rowHeight, "56px", `the one-line row is 56px (got ${fills.light.rowHeight})`);
  console.log(`light/dark: label ${fills.light.label} -> ${fills.dark.label}, one-line row 56px`);

  // RTL: the indent follows the inline start; a placement end toggle sits on
  // the inline end.
  await reset({ dir: "rtl" });
  const rtl = await page.evaluate((nodes) => {
    const tree = window.tree.createTree({ nodes, expanded: ["src"], indent: 24 });
    document.body.append(tree.element);
    const parent = tree.element.querySelector('[data-value="src"] .mtrl-tree__row');
    const child = tree.element.querySelector('[data-value="tree"] .mtrl-tree__row');
    return {
      parentStart: getComputedStyle(parent).paddingRight,
      childStart: getComputedStyle(child).paddingRight,
      parentLeft: getComputedStyle(parent).paddingLeft,
    };
  }, NODES);
  assert.equal(rtl.parentStart, "16px", `the root row carries only the base inline padding (got ${rtl.parentStart})`);
  assert.equal(rtl.childStart, "40px", `the child indents 24 more from the inline start — right in RTL (got ${rtl.childStart})`);
  assert.equal(rtl.parentLeft, "16px", "the base inline padding stays on the inline end (physical left in RTL)");
  console.log(`rtl: the child's padding-right is ${rtl.childStart}, the physical left ${rtl.parentLeft}`);

  // Keyboard: the APG vertical map in a real browser.
  await reset();
  const keyboard = await page.evaluate(() => {
    const nodes = [
      { value: "src", label: "src", children: [{ value: "tree", label: "tree.ts" }] },
      { value: "readme", label: "README", supportingText: "Notes" },
    ];
    const tree = window.tree.createTree({ nodes, selection: "multiple" });
    document.body.append(tree.element);
    const q = (v) => tree.element.querySelector(`[data-value="${v}"]`);
    const key = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
    q("src").focus();
    key(q("src"), "ArrowRight");
    const open = tree.getExpanded();
    key(q("src"), "ArrowRight");
    const inChild = document.activeElement?.dataset?.value;
    key(q("tree"), " ");
    const values = tree.getValues();
    key(document.activeElement, "ArrowDown");
    const focusAfterArrow = document.activeElement?.dataset?.value;

    return { open, inChild, values, focusAfterArrow };
  });
  assert.deepEqual(keyboard.open, ["src"], "ArrowRight opens a closed parent");
  assert.equal(keyboard.inChild, "tree", "ArrowRight on an open parent moves to the first child");
  assert.deepEqual(keyboard.values, ["tree"], "Space toggles the focused node in multiple mode");
  assert.equal(keyboard.focusAfterArrow, "readme", "ArrowDown moves focus without changing values");
  console.log("keyboard: open, descend, Space toggle, arrows move focus only");

  // Forced colours: the selected row is Highlight/HighlightText.
  await reset();
  await page.emulateMedia({ forcedColors: "active" });
  const forced = await page.evaluate((nodes) => {
    const tree = window.tree.createTree({ nodes, selection: "single", value: "readme" });
    document.body.append(tree.element);
    const row = tree.element.querySelector('[data-value="readme"] .mtrl-tree__row');
    return { background: getComputedStyle(row).backgroundColor, color: getComputedStyle(row).color };
  }, NODES);
  await page.emulateMedia({ forcedColors: "none" });
  assert.notEqual(forced.background, "rgba(0, 0, 0, 0)", "forced colours paint the selected row");
  console.log(`forced colours: selected row ${forced.background} / ${forced.color}`);

  // Reduced motion: the group duration is 0ms.
  await reset();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await page.evaluate((nodes) => {
    const tree = window.tree.createTree({ nodes });
    document.body.append(tree.element);
    return getComputedStyle(tree.element).getPropertyValue("--mtrl-tree-duration").trim();
  }, NODES);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  assert.equal(reduced, "0ms", `reduced motion zeroes the duration (got ${reduced})`);
  console.log("reduced motion: --mtrl-tree-duration 0ms");

  // The element: pre-upgrade nested items hide; after defineTree() they
  // render from the declarations.
  await reset();
  const element = await page.evaluate(() => {
    document.body.innerHTML = `
      <m-tree selection="multiple" aria-label="Files">
        <m-tree-item value="src" label="src" expanded>
          <m-tree-item value="tree" label="tree.ts"></m-tree-item>
        </m-tree-item>
        <m-tree-item value="readme" label="README" selected></m-tree-item>
      </m-tree>`;
    const host = document.querySelector("m-tree");
    const nestedBefore = host.querySelector("m-tree-item m-tree-item");
    const hiddenBefore = getComputedStyle(nestedBefore).display;
    window.tree.defineTree();
    return {
      hiddenBefore,
      items: host.shadowRoot.querySelectorAll("[role='treeitem']").length,
      group: !!host.shadowRoot.querySelector('[role="group"]'),
      checked: host.shadowRoot.querySelector('[data-value="readme"]')?.getAttribute("aria-checked"),
      label: host.shadowRoot.querySelector(".mtrl-tree")?.getAttribute("aria-label"),
    };
  });
  assert.equal(element.hiddenBefore, "none", "nested items hide before upgrade");
  assert.equal(element.items, 3, "all declared items render after definition");
  assert.equal(element.group, true, "the expanded parent owns a group");
  assert.equal(element.checked, "true", "the selected declaration lands in values");
  assert.equal(element.label, "Files", "the aria-label reaches the tree root");
  console.log("element: pre-upgrade hidden, declarations render, selection lands");

  // The host can cancel each operation before the factory commits it.
  await reset();
  const vetoes = await page.evaluate(() => {
    document.body.innerHTML = `
      <m-tree selection="single" value="readme">
        <m-tree-item value="closed" label="Closed">
          <m-tree-item value="hidden" label="Hidden"></m-tree-item>
        </m-tree-item>
        <m-tree-item value="open" label="Open" expanded>
          <m-tree-item value="shown" label="Shown"></m-tree-item>
        </m-tree-item>
        <m-tree-item value="readme" label="README"></m-tree-item>
      </m-tree>`;
    window.tree.defineTree();
    const host = document.querySelector("m-tree");
    const before = [];
    const after = [];
    for (const name of ["expand", "collapse", "change"]) {
      host.addEventListener(`before${name}`, (event) => {
        before.push([event.type, event.detail.value, event.bubbles, event.composed, event.cancelable]);
        event.preventDefault();
      });
      host.addEventListener(name, () => after.push(name));
    }
    const row = (value) => host.shadowRoot.querySelector(`[data-value="${value}"]`);
    const outcomes = [host.component.expand("closed"), host.component.collapse("open"), host.component.select("shown")];
    return {
      before, after, outcomes,
      expanded: host.component.getExpanded(),
      value: host.component.getValue(),
      closed: row("closed").getAttribute("aria-expanded"),
      open: row("open").getAttribute("aria-expanded"),
      hiddenChild: !!row("hidden"),
      shownChild: !!row("shown"),
      selected: row("readme").getAttribute("aria-selected"),
      proposed: row("shown").getAttribute("aria-selected"),
    };
  });
  assert.deepEqual(vetoes, {
    before: [
      ["beforeexpand", "closed", true, true, true],
      ["beforecollapse", "open", true, true, true],
      ["beforechange", "shown", true, true, true],
    ],
    after: [],
    outcomes: [false, false, false],
    expanded: ["open"],
    value: "readme",
    closed: "false",
    open: "true",
    hiddenChild: false,
    shownChild: true,
    selected: "true",
    proposed: "false",
  });
  console.log("element vetoes: before events cancel expansion, collapse and selection");

  // The focused parent survives a shadow rebuild and focus has one tab stop.
  await reset();
  const shadowFocus = await page.evaluate(() => {
    document.body.innerHTML = `
      <m-tree selection="single" value="src" selection-follows-focus>
        <m-tree-item value="src" label="src">
          <m-tree-item value="tree" label="tree.ts"></m-tree-item>
        </m-tree-item>
        <m-tree-item value="readme" label="README"></m-tree-item>
      </m-tree>`;
    window.tree.defineTree();
    const host = document.querySelector("m-tree");
    const shadow = host.shadowRoot;
    const row = (value) => shadow.querySelector(`[data-value="${value}"]`);
    const key = (key) => shadow.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    const focus = () => ({
      active: shadow.activeElement?.dataset.value,
      stops: [...shadow.querySelectorAll("[role='treeitem'][tabindex='0']")].map((item) => item.dataset.value),
    });
    const original = row("src");
    original.focus();
    key("ArrowRight");
    const opened = { ...focus(), expanded: row("src").getAttribute("aria-expanded"), rebuilt: row("src") !== original };
    const proposed = [];
    const changes = [];
    const veto = (event) => { proposed.push(event.detail.value); event.preventDefault(); };
    host.addEventListener("beforechange", veto);
    host.addEventListener("change", (event) => changes.push(event.detail.value));
    key("End");
    const end = { ...focus(), selected: host.component.getValue(), changes: [...changes] };
    key("Home");
    const home = { ...focus(), selected: host.component.getValue(), changes: [...changes] };
    host.removeEventListener("beforechange", veto);
    key("End");
    const accepted = { ...focus(), selected: host.component.getValue(), changes };
    return { opened, end, home, proposed, accepted };
  });
  assert.deepEqual(shadowFocus, {
    opened: { active: "src", stops: ["src"], expanded: "true", rebuilt: true },
    end: { active: "readme", stops: ["readme"], selected: "src", changes: [] },
    home: { active: "src", stops: ["src"], selected: "src", changes: [] },
    proposed: ["readme", "src"],
    accepted: { active: "readme", stops: ["readme"], selected: "readme", changes: ["readme"] },
  });
  console.log("shadow keyboard: rebuild restores focus, Home and End move the tab stop and honor selection vetoes");

  // The opt-in package entry maps every nested and lazy descendant to a vlist id.
  await reset({ virtual: true });
  await page.evaluate(() => {
    const record = (type) => ({ value, node }) => window.virtualEvents.push([type, value, node.value, node.label]);
    window.virtualEvents = [];
    window.virtualTree = window.createVirtualTree({
      nodes: [
        { value: "root", label: "Root", children: [
          { value: "branch", label: "Branch", children: [{ value: "leaf", label: "Leaf" }] },
          { value: "sibling", label: "Sibling" },
        ] },
        { value: "lazy", label: "Lazy", lazy: true },
      ],
      loadChildren: async () => [
        { value: "loaded", label: "Loaded", children: [
          { value: "loaded-a", label: "Loaded A" },
          { value: "loaded-b", label: "Loaded B" },
        ] },
      ],
      onExpand: record("callback:expand"),
      onCollapse: record("callback:collapse"),
    });
    const tree = window.virtualTree;
    tree.on("expand", record("expand"));
    tree.on("collapse", record("collapse"));
    tree.element.style.height = "480px";
    document.body.append(tree.element);
    tree.expand("root");
    tree.expand("branch");
  });
  const virtualRow = (value) => page.locator(`.mtrl-tree--virtual [role="treeitem"][data-id="${value}"]`);
  await virtualRow("leaf").waitFor({ state: "attached" });
  assert.equal(await virtualRow("leaf").getAttribute("aria-level"), "3");
  assert.equal(await virtualRow("sibling").getAttribute("aria-level"), "2");
  await page.evaluate(() => {
    window.virtualTree.collapse("branch");
    window.virtualTree.expand("lazy");
  });
  await virtualRow("loaded").waitFor({ state: "attached" });
  await page.evaluate(() => window.virtualTree.expand("loaded"));
  await virtualRow("loaded-b").waitFor({ state: "attached" });
  assert.equal(await virtualRow("loaded-a").getAttribute("aria-level"), "3");
  assert.equal(await virtualRow("loaded-b").getAttribute("aria-level"), "3");
  assert.equal(await virtualRow("leaf").count(), 0);
  const virtual = await page.evaluate(() => {
    const result = { events: window.virtualEvents, expanded: window.virtualTree.getExpanded() };
    window.virtualTree.destroy();
    return result;
  });
  assert.deepEqual(virtual.expanded, ["root", "lazy", "loaded"]);
  assert.deepEqual(virtual.events, [
    ["expand", "root", "root", "Root"],
    ["callback:expand", "root", "root", "Root"],
    ["expand", "branch", "branch", "Branch"],
    ["callback:expand", "branch", "branch", "Branch"],
    ["collapse", "branch", "branch", "Branch"],
    ["callback:collapse", "branch", "branch", "Branch"],
    ["expand", "loaded", "loaded", "Loaded"],
    ["callback:expand", "loaded", "loaded", "Loaded"],
  ]);
  console.log("virtual tree: nested and lazy descendants keep their IDs, expansion events reach Material listeners");

  assert.deepEqual(errors, [], "no page errors");
  console.log("Passed tree browser checks.");
} finally {
  await browser?.close();
  await server.close();
}
