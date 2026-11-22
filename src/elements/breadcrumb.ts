// src/elements/breadcrumb.ts
/**
 * `<m-breadcrumb>` and its `<m-breadcrumb-item>` children: the trail as
 * custom elements. Client only: server rendering is deferred until
 * `material`'s renderer accepts another package's specs.
 *
 * The children are declarations: the element reads their `value`, `label`
 * (or text), `href` and `disabled` and rebuilds the trail when they change.
 * The last child is the current page, and its `href` is ignored. The element
 * dispatches a cancelable `beforechange` and, after commit, a `change`.
 *
 * @module elements
 */

import {
  defineElement,
  type DefineOptions,
  type ElementHost,
  type ElementInstance,
  type ElementSpec,
} from "material/elements";
// The overflow opens material's menu inside this shadow root: its sheet is
// registered in the shared registry by this import, as material's own
// menu-hosting elements do
import "material/elements/css/menu";
import { createBreadcrumb } from "../components/breadcrumb";
import type {
  BreadcrumbComponent,
  BreadcrumbConfig,
  BreadcrumbItemConfig,
} from "../components/breadcrumb/types";

type Component = BreadcrumbComponent;

/** One `<m-breadcrumb-item>`: a value, a label, an optional href */
export const breadcrumbItemDeclaration = {
  name: "breadcrumb-item",
  attributes: {
    value: { type: "string" },
    label: { type: "string" },
    href: { type: "string" },
    disabled: { type: "boolean" },
  },
} as const;

const camel = (name: string): string => name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

/**
 * `<m-breadcrumb-item>` declares one trail item and renders nothing itself.
 * `material` does not export `createDeclarationClass` from its public entry,
 * so the same small class is written here, as the stepper's step is: a
 * property set before the definition lands on the attribute the element
 * reads.
 */
const itemClass = (): CustomElementConstructor => {
  class ItemDeclaration extends HTMLElement {}
  for (const [name, attribute] of Object.entries(breadcrumbItemDeclaration.attributes)) {
    Object.defineProperty(ItemDeclaration.prototype, camel(name), {
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
  return ItemDeclaration;
};

const declaredItems = (host: HTMLElement, tag: string): BreadcrumbItemConfig[] => {
  const items: BreadcrumbItemConfig[] = [];
  for (const child of Array.from(host.children)) {
    if (child.localName !== tag) continue;
    const label = child.getAttribute("label") ?? (child.textContent ?? "").trim();
    if (!label) continue;
    items.push({
      value: child.getAttribute("value") ?? undefined,
      label,
      href: child.getAttribute("href") ?? undefined,
      disabled: child.hasAttribute("disabled"),
    });
  }
  return items;
};

const signature = (items: BreadcrumbItemConfig[]): string => JSON.stringify(items);

const breadcrumbSpec = {
  name: "breadcrumb",
  ssr: false,
  // The overflow opens material's menu inside this shadow root, so the
  // menu sheet is registered here as material's own menu-hosting elements do
  styles: ["menu", "breadcrumb"],
  hostStyles: ":host{display:block}",
  create: (config: Record<string, unknown>) => createBreadcrumb(config as BreadcrumbConfig),
  attributes: {
    "no-collapse": { type: "boolean" },
    disabled: {
      type: "boolean",
      config: "disabled",
      update: (c: Component, value: unknown) => void (value ? c.disable() : c.enable()),
    },
    "aria-label": { type: "string", config: "ariaLabel" },
    "overflow-label": { type: "string", config: "overflowLabel" },
  },
  properties: {
    value: {
      get: (c: Component) => c.getValue(),
      set: (c: Component, value: unknown) => void c.setValue(value === null || value === undefined ? null : String(value)),
    },
  },
  model: "value" as const,
  // The authored opt-out is presence: collapse is on unless `no-collapse`
  config: (host: HTMLElement) => ({
    collapse: !host.hasAttribute("no-collapse"),
    items: declaredItems(host, `${host.localName}-item`),
  }),
  methods: [
    "getValue",
    "setValue",
    "getItems",
    "setItems",
    "getItem",
    "goTo",
    "open",
    "close",
    "isOpen",
    "enable",
    "disable",
    "isDisabled",
  ] as const,
  setup: (host: ElementHost<Component>, component: Component) => {
    const tag = `${host.localName}-item`;
    let last = signature(declaredItems(host, tag));
    // The vetoable event: raised before the factory commits, and cancelling
    // it vetoes the factory's beforechange
    const before = (payload: unknown) => {
      const detail = payload as { previousValue: string | null; value: string; preventDefault: () => void };
      const event = new CustomEvent("beforechange", {
        detail: { previousValue: detail.previousValue, value: detail.value },
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      host.dispatchEvent(event);
      if (event.defaultPrevented) detail.preventDefault();
    };
    const after = (payload: unknown) => {
      const detail = payload as { previousValue: string | null; value: string };
      host.dispatchEvent(new CustomEvent("change", {
        detail: { value: detail.value, previousValue: detail.previousValue },
        bubbles: true,
        composed: true,
      }));
    };
    component.on("beforechange", before as never);
    component.on("change", after as never);
    // The model reflects on the host for silent writes too
    const reflect = (): void => {
      const value = component.getValue();
      if (value === null) host.removeAttribute("value");
      else if (host.getAttribute("value") !== value) host.setAttribute("value", value);
      if (host.hasAttribute("disabled") !== component.isDisabled()) host.toggleAttribute("disabled", component.isDisabled());
    };
    const breadcrumb = (component as unknown as { breadcrumb?: { stateListeners: Array<() => void> } }).breadcrumb;
    breadcrumb?.stateListeners.push(reflect);
    reflect();
    const observer = new MutationObserver(() => {
      const items = declaredItems(host, tag);
      const next = signature(items);
      if (next === last) return;
      last = next;
      component.setItems(items);
    });
    observer.observe(host, { childList: true, subtree: true, attributes: true, characterData: true });
    return () => {
      observer.disconnect();
      component.off("beforechange", before as never);
      component.off("change", after as never);
      const at = breadcrumb ? breadcrumb.stateListeners.indexOf(reflect) : -1;
      if (breadcrumb && at !== -1) breadcrumb.stateListeners.splice(at, 1);
    };
  },
} satisfies ElementSpec<Component>;

export const breadcrumbElement = defineElement<Component>(breadcrumbSpec);
export type BreadcrumbSpec = typeof breadcrumbSpec;

/** Registers `<m-breadcrumb>` and `<m-breadcrumb-item>`. */
export const defineBreadcrumb = (options: DefineOptions = {}): string => {
  const tag = `${options?.prefix ?? "mtrl"}-${breadcrumbItemDeclaration.name}`;
  // The declaration first: items already in the page upgrade before the
  // breadcrumb reads them, as the stepper's steps do
  if (!customElements.get(tag)) customElements.define(tag, itemClass());
  return breadcrumbElement.define(options);
};

/** `<m-breadcrumb>` as a ref or a query returns it. */
export type BreadcrumbElement = ElementInstance<BreadcrumbSpec, Component> & {
  value: string | null;
  goTo(value: string): boolean;
  setItems(items: BreadcrumbItemConfig[]): BreadcrumbComponent;
  getItems(): BreadcrumbItemConfig[];
  open(): BreadcrumbComponent;
  close(): BreadcrumbComponent;
  isOpen(): boolean;
};

/** `<m-breadcrumb-item>` as a ref or a query returns it. */
export type BreadcrumbItemElement = HTMLElement & {
  value: string | null;
  label: string | null;
  href: string | null;
  disabled: boolean;
};
