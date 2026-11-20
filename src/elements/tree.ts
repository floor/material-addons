// src/elements/tree.ts
/**
 * `<m-tree>` with `<m-tree-item>` children: the owned-DOM tree as a client
 * element. Items stay in light DOM; the element reads their attributes into
 * the factory's nodes. Client only — SSR is deferred with material's
 * renderer (tree-spec.md section 11).
 *
 * @module elements
 */

import { camel, defineElement, getPrefix, type DefineOptions, type ElementInstance, type ElementSpec } from "material/elements";
import createTree from "../components/tree";
import type { TreeComponent, TreeConfig, TreeNode } from "../components/tree/types";

/** One `<m-tree-item>`'s authored attributes. */
export interface TreeItemAttributes {
  value: string;
  label: string;
  supportingText: string | null;
  expanded: boolean;
  lazy: boolean;
  disabled: boolean;
  selected: boolean;
}

/** Reads a host's `<m-tree-item>` children into factory nodes, recursively. */
const readItems = (host: HTMLElement, itemTag: string): TreeNode[] => {
  const items: TreeNode[] = [];
  for (const child of Array.from(host.children) as HTMLElement[]) {
    if (child.localName !== itemTag) continue;
    const node: TreeNode = {
      value: child.getAttribute("value") ?? "",
      label: child.getAttribute("label") ?? "",
      supportingText: child.getAttribute("supporting-text") ?? undefined,
      expanded: child.hasAttribute("expanded"),
      lazy: child.hasAttribute("lazy"),
      disabled: child.hasAttribute("disabled"),
    };
    const nested = readItems(child, itemTag);
    if (nested.length) node.children = nested;
    (child as HTMLElement & { __selected?: boolean }).__selected = child.hasAttribute("selected");
    items.push(node);
  }
  return items;
};

/** The selected ids from the item declarations. */
const selectedIds = (host: HTMLElement, itemTag: string): string[] => {
  const ids: string[] = [];
  const walk = (element: HTMLElement) => {
    for (const child of Array.from(element.children) as (HTMLElement & { __selected?: boolean })[]) {
      if (child.localName === itemTag && child.__selected) ids.push(child.getAttribute("value") ?? "");
      walk(child);
    }
  };
  walk(host);
  return ids;
};

const spec = {
  name: "tree",
  ssr: false,
  styles: ["tree"],
  hostStyles: ":host{display:block}",
  create: (config: Record<string, unknown>) => createTree(config as TreeConfig),
  attributes: {
    selection: { type: "string", config: "selection", update: (c: TreeComponent, value: unknown) => void c.setValue(c.getValue()) },
    value: { type: "string", config: "value", update: (c: TreeComponent, value: unknown) => void c.setValue(value == null ? null : String(value)) },
    "selection-follows-focus": { type: "boolean", config: "selectionFollowsFocus" },
    placement: { type: "string", config: "placement" },
    "expand-on-click": { type: "boolean", config: "expandOnClick" },
    "no-type-ahead": { type: "boolean" },
    indent: { type: "number", config: "indent" },
    "aria-label": { type: "string", config: "ariaLabel" },
    disabled: { type: "boolean", config: "disabled", update: (c: TreeComponent, value: unknown) => void (value ? c.disable() : c.enable()) },
  },
  config: (host: HTMLElement) => {
    const itemTag = host.localName.replace(/tree$/, "tree-item");
    const nodes = readItems(host, itemTag);
    const selection = host.getAttribute("selection") ?? "none";
    const treeConfig: Record<string, unknown> = { nodes };
    if (selection === "multiple") treeConfig.values = selectedIds(host, itemTag);
    return treeConfig;
  },
  events: {
    expand: {},
    collapse: {},
    change: {},
    activate: {},
    load: {},
    error: {},
  },
} satisfies ElementSpec<TreeComponent>;

export type TreeSpec = typeof spec;
export type TreeElementEventMap = {
  expand: CustomEvent<{ value: string }>;
  collapse: CustomEvent<{ value: string }>;
  change: CustomEvent<{ value: string | null }>;
  activate: CustomEvent<{ value: string }>;
  load: CustomEvent<{ value: string }>;
  error: CustomEvent<{ value: string }>;
};
export type TreeElement = ElementInstance<TreeSpec, TreeComponent>;

const definition = defineElement<TreeComponent>(spec);
let prepared = false;

function prepareElement() {
  const ctor = definition.element;
  if (prepared) return ctor;
  prepared = true;
  return ctor;
}

/**
 * `<m-tree-item>` declares one node and renders nothing itself: the tree
 * reads its attributes into the factory's nodes. `material` does not export
 * `createDeclarationClass` from its public entry, so the same small class is
 * written here, as the stepper's step declaration is.
 */
export const treeItemDeclaration = {
  name: "tree-item",
  attributes: {
    value: { type: "string" },
    label: { type: "string" },
    "supporting-text": { type: "string" },
    expanded: { type: "boolean" },
    lazy: { type: "boolean" },
    disabled: { type: "boolean" },
    selected: { type: "boolean" },
  },
} as const;

const treeItemClass = (): CustomElementConstructor => {
  const attributes = treeItemDeclaration.attributes;
  class TreeItemDeclaration extends HTMLElement {}
  for (const [name, attribute] of Object.entries(attributes)) {
    Object.defineProperty(TreeItemDeclaration.prototype, camel(name), {
      configurable: true,
      get(this: HTMLElement) {
        return attribute.type === "boolean" ? this.hasAttribute(name) : this.getAttribute(name);
      },
      set(this: HTMLElement, value: unknown) {
        if (attribute.type === "boolean") this.toggleAttribute(name, value !== false && value !== null && value !== undefined);
        else if (value === null || value === undefined) this.removeAttribute(name);
        else this.setAttribute(name, String(value));
      },
    });
  }
  return TreeItemDeclaration;
};

/**
 * Defines `<m-tree>` and `<m-tree-item>`. Client only.
 *
 * @param options - The prefix and any definition options
 * @returns The tree tag name that was defined
 */
export function defineTree(options: DefineOptions = {}): string {
  const itemTag = `${options.prefix ?? getPrefix()}-${treeItemDeclaration.name}`;
  if (!customElements.get(itemTag)) customElements.define(itemTag, treeItemClass());
  prepareElement();
  return definition.define(options);
}

export const treeElement = { spec, get element() { return prepareElement(); }, define: defineTree };

declare global {
  /** `document.querySelector("m-…")` returns the element's type (default prefix). */
  interface HTMLElementTagNameMap {
    "m-tree": TreeElement;
    "m-tree-item": HTMLElement & TreeItemAttributes;
  }
}
