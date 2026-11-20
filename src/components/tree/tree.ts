// src/components/tree/tree.ts
//
// The owned-DOM tree: the in-place folder of the lists guidelines ("list
// items containing other list items can expand and collapse in a
// folder-like manner"), the WAI-ARIA Tree View pattern for the interaction
// model M3 does not publish, and the list overview's 56/72/88 row heights.
// Material Design 3 publishes no tree component; every unpublished number is
// a --mtrl-tree-* token or a documented library choice (tree-spec.md).

import { createBase, pipe, withElement, withEvents } from "material/core/compose";
import { TREE_CLASSES, TREE_DEFAULTS, TREE_EVENTS } from "./constants";
import type {
  TreeActivateEvent, TreeBeforeChangeEvent, TreeBeforeExpandEvent, TreeChangeEvent,
  TreeComponent, TreeConfig, TreeNode, TreeExpandEvent, TreeSelection,
} from "./types";

interface Runtime {
  nodes: TreeNode[];
  selection: TreeSelection;
  value: string | null;
  values: string[];
  open: Set<string>;
  loading: Set<string>;
  loaded: Set<string>;
  focus: string | null;
  disabled: boolean;
  selectionFollowsFocus: boolean;
  expandOnClick: boolean;
  typeAhead: boolean;
  placement: "start" | "end";
  indent: number;
  ariaLabel?: string;
  loadChildren?: (node: TreeNode) => Promise<TreeNode[]>;
  buffer: string;
  bufferAt: number;
}

const defaults = (config: TreeConfig): Runtime => {
  const open = new Set<string>();
  if (config.expanded === true) {
    const walk = (list: TreeNode[]) => { for (const node of list) { if (node.children?.length) { open.add(node.value); walk(node.children); } } };
    walk(config.nodes ?? []);
  } else if (Array.isArray(config.expanded)) {
    for (const id of config.expanded) open.add(id);
  } else {
    const walk = (list: TreeNode[]) => { for (const node of list) { if (node.expanded && node.children?.length) open.add(node.value); walk(node.children ?? []); } };
    walk(config.nodes ?? []);
  }
  return {
    nodes: config.nodes ?? [],
    selection: config.selection ?? "none",
    value: config.value ?? null,
    values: config.values ? [...config.values] : [],
    open,
    loading: new Set(),
    loaded: new Set(),
    focus: null,
    disabled: config.disabled ?? false,
    selectionFollowsFocus: config.selectionFollowsFocus ?? false,
    expandOnClick: config.expandOnClick ?? false,
    typeAhead: config.typeAhead ?? true,
    placement: config.placement ?? "start",
    indent: config.indent ?? TREE_DEFAULTS.INDENT,
    ariaLabel: config.ariaLabel,
    loadChildren: config.loadChildren,
    buffer: "",
    bufferAt: 0,
  };
};

/** Every visible enabled node in tree order. */
const visible = (runtime: Runtime): TreeNode[] => {
  const out: TreeNode[] = [];
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      out.push(node);
      if (runtime.open.has(node.value) && node.children?.length) walk(node.children);
    }
  };
  walk(runtime.nodes);
  return out;
};

const find = (runtime: Runtime, value: string): TreeNode | null => {
  let hit: TreeNode | null = null;
  const walk = (list: TreeNode[]) => { for (const node of list) { if (node.value === value) { hit = node; return; } walk(node.children ?? []); if (hit) return; } };
  walk(runtime.nodes);
  return hit;
};

const parentOf = (runtime: Runtime, value: string): TreeNode | null => {
  let hit: TreeNode | null = null;
  const walk = (list: TreeNode[], parent: TreeNode | null) => {
    for (const node of list) { if (node.value === value) { hit = parent; return; } walk(node.children ?? [], node); if (hit) return; }
  };
  walk(runtime.nodes, null);
  return hit;
};

const isParent = (runtime: Runtime, node: TreeNode): boolean =>
  !!node.children?.length || (node.lazy === true && !runtime.loaded.has(node.value));

/** Creates a tree: the folder-style expanding list. */
const createTree = (config: TreeConfig = {}): TreeComponent => {
  const runtime = defaults(config);
  const handlers: Record<string, Set<(payload: never) => void>> = {};
  const base = pipe(createBase, withEvents(), withElement({
    tag: "div",
    className: TREE_CLASSES.ROOT,
    attributes: { role: "tree" },
  }))({ componentName: "tree", ...config });
  const root = base.element as HTMLElement;

  const emit = <T>(name: string, payload: T, onKey?: (payload: T) => void): T => {
    for (const handler of handlers[name] ?? []) (handler as (p: T) => void)(payload);
    onKey?.(payload);
    return payload;
  };

  const vetoable = <T extends { preventDefault(): void; readonly defaultPrevented: boolean }>(
    name: string, make: () => T, onKey?: (payload: T) => void,
  ): T => {
    let prevented = false;
    const payload = make();
    // Built as a literal, not Object.assign: assign would read the getter
    // once and copy today's value; the literal keeps it live on the payload.
    const wrapped = {
      ...payload,
      preventDefault: () => { prevented = true; },
      get defaultPrevented() { return prevented; },
    } as T;
    emit(name, wrapped, onKey);
    return wrapped;
  };

  let flattened: { node: TreeNode; depth: number }[] = [];
  let byId = new Map<string, { node: TreeNode; depth: number }>();

  const flatten = (): void => {
    flattened = [];
    byId = new Map();
    const walk = (list: TreeNode[], depth: number) => {
      for (const node of list) {
        flattened.push({ node, depth });
        byId.set(node.value, { node, depth });
        if (runtime.open.has(node.value) && node.children?.length) walk(node.children, depth + 1);
      }
    };
    walk(runtime.nodes, 0);
  };

  const applySelection = (item: HTMLElement, node: TreeNode): void => {
    if (node.disabled || runtime.selection === "none") {
      item.removeAttribute("aria-selected");
      item.removeAttribute("aria-checked");
      return;
    }
    if (runtime.selection === "single") {
      item.setAttribute("aria-selected", runtime.value === node.value ? "true" : "false");
      item.removeAttribute("aria-checked");
    } else {
      item.setAttribute("aria-checked", runtime.values.includes(node.value) ? "true" : "false");
      item.removeAttribute("aria-selected");
    }
  };

  const rowOf = (node: TreeNode, depth: number): HTMLElement => {
    const owner = root.ownerDocument;
    const item = owner.createElement("div");
    item.className = TREE_CLASSES.ITEM;
    item.setAttribute("role", "treeitem");
    item.dataset.value = node.value;
    const parent = isParent(runtime, node);
    if (parent) item.setAttribute("aria-expanded", runtime.open.has(node.value) ? "true" : "false");
    if (node.disabled) item.setAttribute("aria-disabled", "true");
    if (runtime.loading.has(node.value)) item.setAttribute("aria-busy", "true");
    applySelection(item, node);

    const row = owner.createElement("div");
    row.className = TREE_CLASSES.ROW;
    row.setAttribute("part", "row");
    // The spec's indent is on the row: the base inline padding plus the
    // per-level indent, on the logical inline-start edge.
    row.style.paddingInlineStart = `calc(var(--mtrl-tree-padding-inline) + ${depth * runtime.indent}px)`;
    const toggle = owner.createElement("button");
    toggle.className = TREE_CLASSES.TOGGLE;
    toggle.type = "button";
    toggle.tabIndex = -1;
    toggle.setAttribute("aria-hidden", "true");
    toggle.setAttribute("part", "toggle");
    toggle.textContent = parent ? (runtime.placement === "end" ? "‹" : "›") : "";
    const label = owner.createElement("span");
    label.className = TREE_CLASSES.LABEL;
    label.setAttribute("part", "label");
    label.textContent = node.label;
    if (runtime.placement === "end" ? false : parent) row.append(toggle);
    if (node.leadingIcon) {
      const icon = owner.createElement("span");
      icon.className = TREE_CLASSES.LEADING_ICON;
      icon.setAttribute("aria-hidden", "true");
      icon.setAttribute("part", "leading-icon");
      icon.textContent = node.leadingIcon;
      row.append(icon);
    }
    row.append(label);
    if (node.supportingText !== undefined) {
      const supporting = owner.createElement("span");
      supporting.className = TREE_CLASSES.SUPPORTING_TEXT;
      supporting.setAttribute("part", "supporting-text");
      supporting.textContent = node.supportingText;
      row.append(supporting);
    }
    if (runtime.selection === "multiple") {
      const check = owner.createElement("span");
      check.className = TREE_CLASSES.CHECK;
      check.setAttribute("aria-hidden", "true");
      check.setAttribute("part", "check");
      check.textContent = runtime.values.includes(node.value) ? "✓" : "";
      row.append(check);
    }
    if (runtime.placement === "end" && parent) row.append(toggle);
    item.append(row);
    return item;
  };

  const mount = document.createElement("div");
  mount.style.display = "contents";
  root.append(mount);

  const tabStop = (): string | null => {
    const rows = flattened.filter((entry) => !entry.node.disabled);
    if (!rows.length) return null;
    const selected = runtime.selection === "single" && runtime.value ? rows.find((e) => e.node.value === runtime.value) : undefined;
    if (selected) return selected.node.value;
    const firstChecked = runtime.selection === "multiple" ? rows.find((e) => runtime.values.includes(e.node.value)) : undefined;
    return (firstChecked ?? rows[0]).node.value;
  };

  const render = (): void => {
    // Whether the tree holds DOM focus is read before the rebuild replaces
    // the node that had it, so the focused id can be re-focused after.
    const heldFocus = root.contains(root.ownerDocument.activeElement);
    flatten();
    const owner = root.ownerDocument;
    const previousFocus = runtime.focus;
    const stop = previousFocus && byId.has(previousFocus) && !byId.get(previousFocus)!.node.disabled
      ? previousFocus
      : tabStop();
    runtime.focus = stop;
    mount.replaceChildren();
    const stack: { children: HTMLElement[]; depth: number; list: TreeNode[]; index: number }[] = [];
    const containerOf = (depth: number, parentItem: HTMLElement | null): HTMLElement => {
      if (!parentItem || depth === 0) return mount;
      const group = owner.createElement("div");
      group.className = TREE_CLASSES.GROUP;
      group.setAttribute("role", "group");
      group.setAttribute("part", "group");
      parentItem.append(group);
      return group;
    };
    const renderInto = (list: TreeNode[], depth: number, parentItem: HTMLElement | null): void => {
      const box = containerOf(depth, parentItem);
      for (const node of list) {
        const item = rowOf(node, depth);
        item.setAttribute("part", "item");
        box.append(item);
        if (runtime.open.has(node.value) && node.children?.length) renderInto(node.children, depth + 1, item);
      }
    };
    renderInto(runtime.nodes, 0, null);
    void stack;
    if (runtime.selection === "multiple") root.setAttribute("aria-multiselectable", "true");
    else root.removeAttribute("aria-multiselectable");
    root.setAttribute("aria-label", runtime.ariaLabel ?? "");
    if (!runtime.ariaLabel) root.removeAttribute("aria-label");
    root.setAttribute("aria-disabled", runtime.disabled ? "true" : "");
    if (!runtime.disabled) root.removeAttribute("aria-disabled");
    if (runtime.disabled) root.removeAttribute("tabindex");
    else if (stop) {
      const stopItem = mount.querySelector<HTMLElement>(`[data-value="${stop}"]`);
      if (stopItem) stopItem.tabIndex = 0;
    }
    // A rebuild replaces the node that held DOM focus; the tree held it
    // inside itself before, so the focused id is re-focused on the new node.
    if (heldFocus && runtime.focus) {
      const next = mount.querySelector<HTMLElement>(`[data-value="${runtime.focus}"]`);
      next?.focus();
    }
    // Every rendered treeitem carries a tabindex: 0 on the stop, -1 elsewhere.
    for (const entry of Array.from(mount.querySelectorAll<HTMLElement>("[role='treeitem']"))) {
      entry.tabIndex = entry.dataset.value === stop ? 0 : -1;
    }

  };

  const commitSelection = (nextValue: string | null, nextValues: string[] | null, selecting: string | null): boolean => {
    const previousValue = runtime.value;
    const previousValues = [...runtime.values];
    const event = vetoable<TreeBeforeChangeEvent>(TREE_EVENTS.BEFORE_CHANGE, () => ({
      previousValue,
      value: selecting,
      previousValues,
      values: nextValues ?? undefined,
    }) as TreeBeforeChangeEvent, config.onBeforeChange);
    if (event.defaultPrevented) return false;
    if (nextValues !== null) {
      runtime.values = [...nextValues];
      runtime.value = selecting;
    } else {
      runtime.value = nextValue;
    }
    emit<TreeChangeEvent>(TREE_EVENTS.CHANGE, {
      previousValue,
      value: selecting ?? runtime.value,
      previousValues,
      values: nextValues ?? undefined,
    }, config.onChange);
    render();
    return true;
  };

  const openNode = (node: TreeNode): void => {
    runtime.open.add(node.value);
    render();
  };

  const tryExpand = (node: TreeNode): boolean => {
    if (runtime.disabled || node.disabled || !isParent(runtime, node) || runtime.open.has(node.value)) return false;
    const event = vetoable<TreeBeforeExpandEvent>(TREE_EVENTS.BEFORE_EXPAND, () => ({ value: node.value, node }) as TreeBeforeExpandEvent, config.onBeforeExpand);
    if (event.defaultPrevented) return false;
    if (node.lazy && !runtime.loaded.has(node.value) && runtime.loadChildren) {
      if (runtime.loading.has(node.value)) return false;
      runtime.loading.add(node.value);
      render();
      runtime.loadChildren(node).then((children) => {
        runtime.loading.delete(node.value);
        runtime.loaded.add(node.value);
        node.children = children;
        emit<TreeExpandEvent & { type?: never }>(TREE_EVENTS.LOAD, { value: node.value, node }, config.onLoad);
        if (children.length) openNode(node);
        else { node.lazy = false; render(); }
      }).catch(() => {
        runtime.loading.delete(node.value);
        emit(TREE_EVENTS.ERROR, { value: node.value, node }, config.onError);
        render();
      });
      return true;
    }
    openNode(node);
    emit<TreeExpandEvent>(TREE_EVENTS.EXPAND, { value: node.value, node }, config.onExpand);
    return true;
  };

  const tryCollapse = (node: TreeNode): boolean => {
    if (runtime.disabled || node.disabled || !runtime.open.has(node.value)) return false;
    const event = vetoable<TreeBeforeExpandEvent>(TREE_EVENTS.BEFORE_COLLAPSE, () => ({ value: node.value, node }) as TreeBeforeExpandEvent, config.onBeforeCollapse);
    if (event.defaultPrevented) return false;
    runtime.open.delete(node.value);
    render();
    emit<TreeExpandEvent>(TREE_EVENTS.COLLAPSE, { value: node.value, node }, config.onCollapse);
    return true;
  };

  const select = (value: string): boolean => {
    const node = find(runtime, value);
    if (runtime.disabled || !node || node.disabled || runtime.selection === "none") return false;
    if (runtime.selection === "single") return commitSelection(value, null, value);
    const next = runtime.values.includes(value) ? runtime.values.filter((id) => id !== value) : [...runtime.values, value];
    return commitSelection(null, next, value);
  };

  const focusNode = (value: string): void => {
    runtime.focus = value;
    const item = mount.querySelector<HTMLElement>(`[data-value="${value}"]`);
    if (item) item.focus();
    else render();
  };

  const moveFocus = (delta: number): void => {
    const rows = flattened.filter((entry) => !entry.node.disabled);
    if (!rows.length) return;
    const index = rows.findIndex((entry) => entry.node.value === runtime.focus);
    const next = rows[Math.max(0, Math.min(rows.length - 1, (index < 0 ? 0 : index) + delta))];
    if (next && next.node.value !== runtime.focus) {
      focusNode(next.node.value);
      if (runtime.selectionFollowsFocus && runtime.selection === "single" && !next.node.disabled) {
        commitSelection(next.node.value, null, next.node.value);
      }
    }
  };

  const typeAhead = (character: string): void => {
    if (!runtime.typeAhead || character === " ") return;
    const now = Date.now();
    runtime.buffer = now - runtime.bufferAt > TREE_DEFAULTS.TYPE_AHEAD_BUFFER_MS ? character : runtime.buffer + character;
    runtime.bufferAt = now;
    const prefix = runtime.buffer.toLowerCase();
    const rows = flattened.filter((entry) => !entry.node.disabled && entry.node.label.toLowerCase().startsWith(prefix));
    if (!rows.length) return;
    // The next match after the focused node, wrapping — typing the prefix of
    // the focused node itself moves off it, per the APG pattern.
    const from = rows.findIndex((entry) => entry.node.value === runtime.focus);
    const next = rows[(from + 1) % rows.length];
    focusNode(next.node.value);
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (runtime.disabled) return;
    const node = runtime.focus ? byId.get(runtime.focus)?.node ?? null : null;
    const key = event.key;
    if (key === "ArrowDown") { event.preventDefault(); moveFocus(1); return; }
    if (key === "ArrowUp") { event.preventDefault(); moveFocus(-1); return; }
    if (key === "ArrowRight") {
      event.preventDefault();
      if (node && isParent(runtime, node)) {
        if (!runtime.open.has(node.value)) tryExpand(node);
        else {
          const child = (node.children ?? []).find((candidate) => !candidate.disabled);
          if (child) focusNode(child.value);
        }
      }
      return;
    }
    if (key === "ArrowLeft") {
      event.preventDefault();
      if (node && isParent(runtime, node) && runtime.open.has(node.value)) { tryCollapse(node); return; }
      if (node) {
        const parent = parentOf(runtime, node.value);
        if (parent && !parent.disabled) focusNode(parent.value);
      }
      return;
    }
    if (key === "Home") { event.preventDefault(); const rows = flattened.filter((e) => !e.node.disabled); if (rows.length) focusNode(rows[0].node.value); return; }
    if (key === "End") { event.preventDefault(); const rows = flattened.filter((e) => !e.node.disabled); if (rows.length) focusNode(rows[rows.length - 1].node.value); return; }
    if (key === "Enter") {
      event.preventDefault();
      if (node) {
        emit<TreeActivateEvent>(TREE_EVENTS.ACTIVATE, { value: node.value, node, originalEvent: event }, config.onActivate);
        if (runtime.selection === "single" && !runtime.selectionFollowsFocus) select(node.value);
      }
      return;
    }
    if (key === " ") {
      if (runtime.selection === "multiple") { event.preventDefault(); if (node) select(node.value); }
      else if (runtime.typeAhead) event.preventDefault();
      return;
    }
    if (key === "*" && node) {
      event.preventDefault();
      const parent = parentOf(runtime, node.value);
      // Loaded siblings only: `*` never fetches lazy children.
      const siblings = (parent?.children ?? runtime.nodes).filter((candidate) => !!candidate.children?.length);
      for (const sibling of siblings) if (!runtime.open.has(sibling.value)) tryExpand(sibling);
      return;
    }
    if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); typeAhead(key); }
  };

  const onClick = (event: MouseEvent): void => {
    if (runtime.disabled) return;
    const target = event.target as HTMLElement;
    const item = target.closest<HTMLElement>(`.${TREE_CLASSES.ITEM}`);
    if (!item) return;
    const value = item.dataset.value ?? "";
    const node = find(runtime, value);
    if (!node || node.disabled) return;
    const toggle = target.closest<HTMLElement>(`.${TREE_CLASSES.TOGGLE}`);
    if (toggle) {
      if (runtime.open.has(value)) tryCollapse(node); else tryExpand(node);
      return;
    }
    if (runtime.selection !== "none") select(value);
    if (runtime.expandOnClick && isParent(runtime, node)) {
      if (runtime.open.has(value)) tryCollapse(node); else tryExpand(node);
    }
  };

  root.addEventListener("keydown", onKeydown);
  root.addEventListener("click", onClick);

  render();

  const tree: TreeComponent = {
    get element() { return root; },
    getValue: () => runtime.value,
    setValue(value) { runtime.value = value; render(); return tree; },
    getValues: () => runtime.selection === "multiple" ? [...runtime.values] : runtime.value ? [runtime.value] : [],
    setValues(values) { runtime.values = [...values]; render(); return tree; },
    select,
    expand: (value) => { const node = find(runtime, value); return node ? tryExpand(node) : false; },
    collapse: (value) => { const node = find(runtime, value); return node ? tryCollapse(node) : false; },
    toggle(value) { const node = find(runtime, value); if (!node) return false; return runtime.open.has(value) ? tryCollapse(node) : tryExpand(node); },
    expandAll() {
      const walk = (list: TreeNode[]) => { for (const node of list) { if (node.children?.length) { runtime.open.add(node.value); walk(node.children); } } };
      walk(runtime.nodes);
      render();
      return tree;
    },
    collapseAll() { runtime.open.clear(); render(); return tree; },
    getExpanded: () => [...runtime.open],
    getNode: (value) => { const node = find(runtime, value); return node ? { ...node } : null; },
    setNodes(nodes) {
      const open = [...runtime.open];
      runtime.nodes = nodes;
      runtime.open = new Set(open.filter((id) => find(runtime, id)));
      render();
      return tree;
    },
    enable: () => { runtime.disabled = false; render(); },
    disable: () => { runtime.disabled = true; render(); },
    isDisabled: () => runtime.disabled,
    on(name, handler) { (handlers[name] ??= new Set()).add(handler); return tree; },
    off(name, handler) { handlers[name]?.delete(handler); return tree; },
    focus: () => { if (runtime.focus) focusNode(runtime.focus); },
    destroy() {
      root.removeEventListener("keydown", onKeydown);
      root.removeEventListener("click", onClick);
      for (const node of Array.from(mount.querySelectorAll("[tabindex]"))) (node as HTMLElement).tabIndex = -1;
      root.remove();
      base.destroy?.();
    },
  };
  return tree;
};

export default createTree;
