// src/components/tree/virtual.ts
//
// The large-tree entry: the ONLY tree module that imports vlist — the
// default entry stays vlist-free, which the package check asserts. vlist's
// tree plugin owns flatten, the window, expand/collapse, `*`, type-ahead and
// the partial-DOM ARIA (aria-level/setsize/posinset); this layer owns the
// Material skin (the --mtrl-tree-* tokens mapped onto the --vlist-tree-*
// variables the plugin already sets), the selection model and the events.
// vlist 3.8.6 offers no row-template hook, so the Material row is applied
// through the stylesheet, the plugin's own customization route (tree-spec.md
// section 14).

import { createVList, tree as treePlugin } from "vlist";
import { TREE_DEFAULTS, TREE_EVENTS } from "./constants";
import type {
  TreeBeforeChangeEvent, TreeChangeEvent, TreeComponent, TreeConfig, TreeExpandEvent, TreeNode,
} from "./types";

export interface VirtualTreeConfig extends TreeConfig {
  /** Rows kept mounted above and below the window. Default 8. */
  overscan?: number;
  /** The scroll container's height in pixels. Default 480. */
  height?: number;
}

type Row = Omit<TreeNode, "children"> & { id: string; children?: Row[] };

const toRows = (nodes: TreeNode[]): Row[] => nodes.map(({ children, ...node }) => ({
  ...node,
  id: node.value,
  ...(children && { children: toRows(children) }),
}));

/** Creates a windowed tree for large data sets, on vlist's tree plugin. */
export const createVirtualTree = (config: VirtualTreeConfig = {}): TreeComponent => {
  const selection = config.selection ?? "none";
  let value: string | null = config.value ?? null;
  let values: string[] = config.values ? [...config.values] : [];
  const handlers: Record<string, Set<(payload: never) => void>> = {};

  const container = (typeof document !== "undefined" ? document : null)?.createElement("div") ?? ({} as HTMLElement);
  const list = createVList(
    {
      container,
      // The list overview's one-line row height; the tree plugin's rows are
      // single-line unless a supporting text renders inside them.
      item: { height: 56, template: () => document.createElement("div") },
      overscan: config.overscan ?? 8,
      items: toRows(config.nodes ?? []),
    },
    [
      treePlugin<Row>({
        children: "children",
        label: "label",
        indent: config.indent ?? TREE_DEFAULTS.INDENT,
        expanded: Array.isArray(config.expanded) ? config.expanded : config.expanded === true,
        expandOnClick: config.expandOnClick ?? false,
        loadChildren: config.loadChildren
          ? async (row: Row) => toRows(await config.loadChildren!(row))
          : undefined,
      }),
    ],
  );

  const root = list.element;
  root.classList.add("mtrl-tree", "mtrl-tree--virtual");
  root.setAttribute("role", "tree");
  if (config.ariaLabel) root.setAttribute("aria-label", config.ariaLabel);
  if (selection === "multiple") root.setAttribute("aria-multiselectable", "true");
  if (config.disabled) root.setAttribute("aria-disabled", "true");

  const emit = <T>(name: string, payload: T, callback?: (event: T) => void): void => {
    for (const handler of handlers[name] ?? []) (handler as (p: T) => void)(payload);
    callback?.(payload);
  };

  const offExpand = list.on("tree:expand", ({ item }) => {
    emit<TreeExpandEvent>(TREE_EVENTS.EXPAND, { value: item.value, node: item }, config.onExpand);
  });
  const offCollapse = list.on("tree:collapse", ({ item }) => {
    emit<TreeExpandEvent>(TREE_EVENTS.COLLAPSE, { value: item.value, node: item }, config.onCollapse);
  });

  const rowOf = (id: string): Row | undefined => list.items.find((row) => row.value === id);

  const commit = (nextValue: string | null, nextValues: string[] | null, selecting: string | null): boolean => {
    const previousValue = value;
    const previousValues = [...values];
    let prevented = false;
    emit<TreeBeforeChangeEvent>(TREE_EVENTS.BEFORE_CHANGE, {
      previousValue,
      value: selecting,
      previousValues,
      values: nextValues ?? undefined,
      preventDefault: () => { prevented = true; },
      get defaultPrevented() { return prevented; },
    } as TreeBeforeChangeEvent);
    if (prevented) return false;
    if (nextValues !== null) { values = [...nextValues]; value = selecting; }
    else value = nextValue;
    emit<TreeChangeEvent>(TREE_EVENTS.CHANGE, {
      previousValue,
      value: selecting ?? value,
      previousValues,
      values: nextValues ?? undefined,
    });
    return true;
  };

  const onClick = (event: MouseEvent): void => {
    if (root.getAttribute("aria-disabled") === "true") return;
    const row = (event.target as HTMLElement).closest("[role='treeitem']");
    if (!row) return;
    const id = row.getAttribute("data-id");
    if (!id) return;
    const node = rowOf(id);
    if (!node || node.disabled) return;
    if (selection === "single") commit(id, null, id);
    else if (selection === "multiple") {
      const next = values.includes(id) ? values.filter((entry) => entry !== id) : [...values, id];
      commit(null, next, id);
    }
  };
  root.addEventListener("click", onClick);

  const tree: TreeComponent = {
    get element() { return root; },
    getValue: () => value,
    setValue(next) { value = next; return tree; },
    getValues: () => selection === "multiple" ? [...values] : value ? [value] : [],
    setValues(next) { values = [...next]; return tree; },
    select(id) {
      if (selection === "none") return false;
      if (selection === "single") return commit(id, null, id);
      const next = values.includes(id) ? values.filter((entry) => entry !== id) : [...values, id];
      return commit(null, next, id);
    },
    expand(id) { list.expand(id); return true; },
    collapse(id) { list.collapse(id); return true; },
    toggle(id) { list.toggle(id); return true; },
    expandAll() { list.expandAll(); return tree; },
    collapseAll() { list.collapseAll(); return tree; },
    getExpanded: () => list.getExpanded().map(String),
    getNode(id) { const row = rowOf(id); return row ? { ...row } : null; },
    setNodes(nodes) { list.setItems(toRows(nodes)); return tree; },
    enable() { root.removeAttribute("aria-disabled"); },
    disable() { root.setAttribute("aria-disabled", "true"); },
    isDisabled: () => root.getAttribute("aria-disabled") === "true",
    on(name, handler) { (handlers[name] ??= new Set()).add(handler); return tree; },
    off(name, handler) { handlers[name]?.delete(handler); return tree; },
    focus() { root.focus(); },
    destroy() {
      root.removeEventListener("click", onClick);
      offExpand();
      offCollapse();
      list.destroy();
      root.remove();
    },
  };
  return tree;
};

export default createVirtualTree;
