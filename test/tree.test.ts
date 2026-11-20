// test/tree.test.ts
//
// The owned-DOM tree, per the spec note's unit plan. jsdom carries the DOM;
// the keyboard map is exercised through real events.

import { beforeAll, describe, expect, test } from "bun:test";
import { installAutocompleteDom } from "./utils/autocomplete-dom";
import { JSDOM } from "jsdom";

let dom: JSDOM;
beforeAll(() => {
  dom = new JSDOM("<!doctype html><body></body>", { pretendToBeVisual: true });
  for (const key of ["KeyboardEvent", "MouseEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"] as const) {
    (globalThis as Record<string, unknown>)[key] = dom.window[key];
  }
});
import createTree from "../src/components/tree";

const NODES = [
  { value: "src", label: "src", children: [
    { value: "tree", label: "tree.ts" },
    { value: "virtual", label: "virtual.ts" },
  ] },
  { value: "docs", label: "docs", disabled: true, children: [{ value: "spec", label: "spec.md" }] },
  { value: "readme", label: "README", supportingText: "Notes" },
];

const key = (element: HTMLElement, k: string) =>
  element.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

describe("createTree", () => {
  installAutocompleteDom();

  test("defaults and anatomy", () => {
    const tree = createTree({ nodes: NODES });
    document.body.append(tree.element);
    const root = tree.element;
    expect(root.getAttribute("role")).toBe("tree");
    const src = root.querySelector('[data-value="src"]');
    expect(src?.getAttribute("aria-expanded")).toBe("false");
    const group = src?.querySelector(".mtrl-tree__group");
    expect(group ?? null).toBeNull(); // collapsed: no group in the rendered tree
    const readme = root.querySelector('[data-value="readme"]');
    expect(readme?.hasAttribute("aria-expanded")).toBe(false); // end node
    expect(tree.getValue()).toBe(null);
    expect(tree.getExpanded()).toEqual([]);
    tree.destroy();
  });

  test("expand and collapse, with vetoes", () => {
    const tree = createTree({ nodes: NODES });
    document.body.append(tree.element);
    const seen: string[] = [];
    tree.on("beforeexpand", ((e: { preventDefault(): void }) => { seen.push("before"); e.preventDefault(); }) as never);
    expect(tree.expand("src")).toBe(false);
    expect(tree.getExpanded()).toEqual([]);
    tree.off("beforeexpand", ((e: unknown) => e) as never);
    const tree2 = createTree({ nodes: NODES });
    document.body.append(tree2.element);
    let opened = false;
    tree2.on("expand", (() => { opened = true; }) as never);
    expect(tree2.expand("src")).toBe(true);
    expect(opened).toBe(true);
    expect(tree2.getExpanded()).toEqual(["src"]);
    expect(tree2.element.querySelector('[data-value="src"]')?.getAttribute("aria-expanded")).toBe("true");
    expect(tree2.element.querySelector('[data-value="src"] .mtrl-tree__group')).toBeTruthy();
    expect(tree2.collapse("src")).toBe(true);
    expect(tree2.getExpanded()).toEqual([]);
    tree.destroy(); tree2.destroy();
  });

  test("keyboard: arrows, Home, End, disabled skipping, Enter", () => {
    const tree = createTree({ nodes: NODES, selection: "single" });
    document.body.append(tree.element);
    const root = tree.element;
    const item = (value: string) => root.querySelector(`[data-value="${value}"]`) as HTMLElement;
    item("src").focus();
    key(item("src"), "ArrowRight");
    expect(tree.getExpanded()).toEqual(["src"]);
    key(item("src"), "ArrowRight"); // open parent: first child
    expect(document.activeElement).toBe(item("tree"));
    key(item("tree"), "ArrowDown"); // next enabled visible node (virtual)
    expect(document.activeElement).toBe(item("virtual"));
    key(item("readme"), "Home");
    expect(document.activeElement).toBe(item("src"));
    key(item("src"), "ArrowLeft"); // open parent: closes
    expect(tree.getExpanded()).toEqual([]);
    key(item("src"), "Enter");
    expect(tree.getValue()).toBe("src");
    tree.destroy();
  });

  test("single selection: aria-selected only, veto, focus independence", () => {
    const tree = createTree({ nodes: NODES, selection: "single" });
    document.body.append(tree.element);
    tree.select("src");
    const items = tree.element.querySelectorAll("[role='treeitem']");
    expect(items[0].getAttribute("aria-selected")).toBe("true");
    expect(items[2].getAttribute("aria-selected")).toBe("false"); // readme, selectable
    expect(items[1].hasAttribute("aria-selected")).toBe(false); // docs, disabled: neither attribute
    expect(items[0].hasAttribute("aria-checked")).toBe(false);
    const stop = createTree({ nodes: NODES, selection: "single" });
    document.body.append(stop.element);
    stop.on("beforechange", ((e: { preventDefault(): void }) => e.preventDefault()) as never);
    expect(stop.select("src")).toBe(false);
    expect(stop.getValue()).toBe(null);
    tree.destroy(); stop.destroy();
  });

  test("selection follows focus only when asked", () => {
    const tree = createTree({ nodes: NODES, selection: "single", selectionFollowsFocus: true });
    document.body.append(tree.element);
    const item = (v: string) => tree.element.querySelector(`[data-value="${v}"]`) as HTMLElement;
    item("src").focus();
    key(item("src"), "ArrowDown");
    expect(tree.getValue()).toBe("readme");
    tree.destroy();
  });

  test("multiple selection: aria-checked, Space toggles, arrows do not select", () => {
    const tree = createTree({ nodes: NODES, selection: "multiple" });
    document.body.append(tree.element);
    expect(tree.element.getAttribute("aria-multiselectable")).toBe("true");
    const item = (v: string) => tree.element.querySelector(`[data-value="${v}"]`) as HTMLElement;
    expect(item("src").hasAttribute("aria-selected")).toBe(false);
    item("src").focus();
    key(item("src"), " ");
    expect(tree.getValues()).toEqual(["src"]);
    expect(item("src").getAttribute("aria-checked")).toBe("true");
    key(item("src"), "ArrowDown");
    expect(tree.getValues()).toEqual(["src"]);
    expect(document.activeElement).toBe(item("readme"));
    key(item("readme"), " ");
    expect(tree.getValues()).toEqual(["src", "readme"]);
    tree.destroy();
  });

  test("none: no selection attributes, Enter still activates", () => {
    let activated = false;
    const tree = createTree({ nodes: NODES, onActivate: () => { activated = true; } });
    document.body.append(tree.element);
    const item = tree.element.querySelector('[data-value="src"]') as HTMLElement;
    expect(item.hasAttribute("aria-selected")).toBe(false);
    expect(item.hasAttribute("aria-checked")).toBe(false);
    item.focus();
    key(item, "Enter");
    expect(activated).toBe(true);
    expect(tree.getValue()).toBe(null);
    tree.destroy();
  });

  test("lazy: load on first expand, empty list ends the node, rejection errors", async () => {
    let calls = 0;
    const tree = createTree({
      nodes: [{ value: "lazy", label: "Lazy", lazy: true, children: [] }],
      loadChildren: async () => { calls += 1; return calls === 1 ? [{ value: "child", label: "Child" }] : []; },
    });
    document.body.append(tree.element);
    const item = () => tree.element.querySelector('[data-value="lazy"]') as HTMLElement;
    expect(item().getAttribute("aria-expanded")).toBe("false");
    tree.expand("lazy");
    expect(item().getAttribute("aria-busy")).toBe("true");
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toBe(1);
    expect(tree.getExpanded()).toEqual(["lazy"]);
    const fail = createTree({
      nodes: [{ value: "boom", label: "Boom", lazy: true }],
      loadChildren: async () => { throw new Error("no"); },
    });
    document.body.append(fail.element);
    let errored = false;
    fail.on("error", (() => { errored = true; }) as never);
    fail.expand("boom");
    await new Promise((r) => setTimeout(r, 20));
    expect(errored).toBe(true);
    expect(fail.getExpanded()).toEqual([]);
    const never = createTree({ nodes: [{ value: "end", label: "End" }], loadChildren: async () => { calls += 99; return []; } });
    document.body.append(never.element);
    never.expand("end");
    expect(calls).toBe(1); // a childless non-lazy node never loads
    tree.destroy(); fail.destroy(); never.destroy();
  });

  test("type-ahead skips disabled; buffer, not a per-key reset", () => {
    const tree = createTree({ nodes: [
      { value: "a1", label: "alpha" },
      { value: "d", label: "delta", disabled: true },
      { value: "a2", label: "aomega" },
    ] });
    document.body.append(tree.element);
    const item = (v: string) => tree.element.querySelector(`[data-value="${v}"]`) as HTMLElement;
    item("a1").focus();
    key(item("a1"), "a");
    expect(document.activeElement).toBe(item("a2")); // skips disabled delta
    tree.destroy();
  });

  test("* expands loaded siblings and never loads", () => {
    let calls = 0;
    const tree = createTree({
      nodes: [
        { value: "one", label: "One", children: [{ value: "one-a", label: "A" }] },
        { value: "lazy", label: "Lazy", lazy: true },
        { value: "two", label: "Two", children: [{ value: "two-a", label: "A" }] },
      ],
      loadChildren: async () => { calls += 1; return []; },
    });
    document.body.append(tree.element);
    const item = (v: string) => tree.element.querySelector(`[data-value="${v}"]`) as HTMLElement;
    item("one").focus();
    key(item("one"), "*");
    expect(tree.getExpanded().sort()).toEqual(["one", "two"]);
    expect(calls).toBe(0);
    tree.destroy();
  });

  test("setNodes keeps the ids that still exist; getNode snapshots", () => {
    const tree = createTree({ nodes: NODES, expanded: ["src"] });
    document.body.append(tree.element);
    tree.setNodes([{ value: "src", label: "src", children: [{ value: "tree", label: "tree.ts" }] }]);
    expect(tree.getExpanded()).toEqual(["src"]);
    expect(tree.getNode("readme")).toBeNull();
    expect(tree.getNode("src")?.label).toBe("src");
    tree.destroy();
  });
});
