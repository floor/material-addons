// src/elements/expansion-panel.ts
/**
 * `<m-expansion-panel>` and `<m-accordion>`: a disclosure panel and the group
 * that coordinates several of them, as client custom elements.
 *
 * The panel's children stay in the light DOM: the default slot is the body,
 * `slot="label"` and `slot="supporting-text"` replace the header text, and
 * `slot="actions"` fills the footer. The accordion coordinates its
 * `<m-expansion-panel>` children in place and renders them through a slot.
 *
 * Client only: server rendering of another package's specs is deferred.
 *
 * @module elements
 */

import {
  DEFAULT_PREFIX,
  defineElement,
  type AttributeSpec,
  type DefineOptions,
  type ElementHost,
  type ElementSpec,
} from "material/elements";
import { createAccordion, createExpansionPanel, reconcilePanels, unregisterPanel } from "../components/expansion-panel";
import {
  EXPANSION_PANEL_EVENTS,
  type ExpansionPanelDensity,
  type ExpansionPanelPlacement,
  type ExpansionPanelVariant,
} from "../components/expansion-panel/constants";
import type {
  AccordionComponent,
  ExpansionPanelComponent,
  ExpansionPanelConfig,
  ExpansionPanelEvents,
} from "../components/expansion-panel/types";

type AttributeValue = Parameters<NonNullable<AttributeSpec<ExpansionPanelComponent>["update"]>>[1];

const slotFor = (name?: string): HTMLSlotElement => {
  const slot = document.createElement("slot");
  if (name) slot.name = name;
  return slot;
};

/** A child node with this slot name, when the author supplied one */
const slotted = (host: HTMLElement, name: string): HTMLSlotElement | undefined =>
  Array.from(host.children).some((child) => child.getAttribute("slot") === name) ? slotFor(name) : undefined;

/** The children this element claimed, so a removal can unregister them */
const claimedPanels = new WeakMap<AccordionComponent, Set<ExpansionPanelComponent>>();

/** Claims upgraded panel children, drops removed ones, then reconciles */
const claimPanels = (host: HTMLElement, component: AccordionComponent): void => {
  let claims = claimedPanels.get(component);
  if (!claims) {
    claims = new Set();
    claimedPanels.set(component, claims);
  }
  for (const child of Array.from(host.children)) {
    if (child.localName !== "m-expansion-panel") continue;
    const panel = (child as unknown as { component: ExpansionPanelComponent | null }).component;
    const known = component.getPanels().some((candidate) => candidate.element === panel?.element);
    if (panel && !known) {
      component.addPanel(panel);
      claims.add(panel);
    }
  }
  for (const panel of claims) {
    // A panel's own element lives in its shadow root: the child is the host
    const root = panel.element.getRootNode();
    if (host.contains(root instanceof ShadowRoot ? root.host : panel.element)) continue;
    claims.delete(panel);
    unregisterPanel(component, panel);
  }
  reconcilePanels(component);
};

const panelSpec = {
  name: "expansion-panel",
  ssr: false,
  styles: ["expansion-panel"],
  hostStyles: ":host{display:block}",
  create: (config: Record<string, unknown>) => createExpansionPanel(config as ExpansionPanelConfig),
  attributes: {
    open: {
      type: "boolean",
      config: "open",
      update: (c: ExpansionPanelComponent, value: AttributeValue, host: HTMLElement) => {
        void (value ? c.open() : c.close());
        // A veto leaves the state where it was: the attribute follows it back
        queueMicrotask(() => host.toggleAttribute("open", c.isOpen()));
      },
    },
    value: { type: "string", config: "value" },
    label: { type: "string", config: "label" },
    "supporting-text": { type: "string", config: "supportingText" },
    variant: {
      type: "string",
      config: "variant",
      update: (c: ExpansionPanelComponent, value: AttributeValue) => {
        if (value) c.setVariant(value as ExpansionPanelVariant);
      },
    },
    density: {
      type: "string",
      config: "density",
      update: (c: ExpansionPanelComponent, value: AttributeValue) => {
        if (value) c.setDensity(value as ExpansionPanelDensity);
      },
    },
    placement: {
      type: "string",
      config: "placement",
      update: (c: ExpansionPanelComponent, value: AttributeValue) => {
        if (value) c.setPlacement(value as ExpansionPanelPlacement);
      },
    },
    "no-toggle": { type: "boolean", config: "noToggle" },
    "leading-icon": { type: "string", config: "leadingIcon" },
    "trailing-icon": { type: "string", config: "trailingIcon" },
    divider: { type: "boolean", config: "divider" },
    lazy: { type: "boolean", config: "lazy" },
    error: {
      type: "boolean",
      config: "error",
      update: (c: ExpansionPanelComponent, value: AttributeValue) => void c.setError(!!value),
    },
    disabled: {
      type: "boolean",
      config: "disabled",
      update: (c: ExpansionPanelComponent, value: AttributeValue) => void (value ? c.disable() : c.enable()),
    },
    "heading-level": { type: "number", config: "headingLevel" },
    "aria-label": {
      type: "string",
      config: "ariaLabel",
      update: (c: ExpansionPanelComponent, value: AttributeValue) =>
        value ? c.header.setAttribute("aria-label", String(value)) : c.header.removeAttribute("aria-label"),
    },
  },
  methods: [
    "close",
    "toggle",
    "isOpen",
    "setOpen",
    "getValue",
    "setValue",
    "getLabel",
    "setLabel",
    "getSupportingText",
    "setSupportingText",
    "setError",
    "isError",
    "setVariant",
    "getVariant",
    "setDensity",
    "getDensity",
    "setPlacement",
    "getPlacement",
    "setContent",
    "setActions",
    "focus",
    "enable",
    "disable",
    "isDisabled",
  ] as const,
  events: {
    open: {},
    afteropen: {},
    close: {},
    afterclose: {},
    change: {},
  },
  config: (host: HTMLElement) => ({
    // A slot replaces the attribute only when the author gave that child
    ...(slotted(host, "label") ? { label: slotted(host, "label") } : {}),
    ...(slotted(host, "supporting-text") ? { supportingText: slotted(host, "supporting-text") } : {}),
    ...(slotted(host, "actions") ? { actions: slotted(host, "actions") } : {}),
    content: (body: HTMLElement) => body.appendChild(slotFor()),
  }),
  setup: (host: ElementHost<ExpansionPanelComponent>, component: ExpansionPanelComponent) => {
    // The Boolean `open` property is the state; the command has its own name
    Object.defineProperty(host, "openPanel", {
      configurable: true,
      value: () => component.open(),
    });
    // The factory's state drives the host's `open` attribute, as `<details>`
    const reflect = (): void => void host.toggleAttribute("open", component.isOpen());
    const onOpen = (): void => reflect();
    const onClose = (): void => reflect();
    component.on(EXPANSION_PANEL_EVENTS.OPEN, onOpen);
    component.on(EXPANSION_PANEL_EVENTS.CLOSE, onClose);
    // Vetoable open and close become cancelable DOM events on the host
    const bridge = (name: "beforeopen" | "beforeclose") => (payload: unknown) => {
      const event = new CustomEvent(name, { detail: { value: (payload as { value: string }).value }, bubbles: true, composed: true, cancelable: true });
      host.dispatchEvent(event);
      if (event.defaultPrevented) (payload as { preventDefault: () => void }).preventDefault();
    };
    const beforeOpen = bridge("beforeopen");
    const beforeClose = bridge("beforeclose");
    component.on(EXPANSION_PANEL_EVENTS.BEFORE_OPEN, beforeOpen as never);
    component.on(EXPANSION_PANEL_EVENTS.BEFORE_CLOSE, beforeClose as never);
    return () => {
      component.off(EXPANSION_PANEL_EVENTS.OPEN, onOpen);
      component.off(EXPANSION_PANEL_EVENTS.CLOSE, onClose);
      component.off(EXPANSION_PANEL_EVENTS.BEFORE_OPEN, beforeOpen as never);
      component.off(EXPANSION_PANEL_EVENTS.BEFORE_CLOSE, beforeClose as never);
    };
  },
} satisfies ElementSpec<ExpansionPanelComponent>;

const accordionSpec = {
  name: "accordion",
  ssr: false,
  styles: ["expansion-panel"],
  hostStyles: ":host{display:block}",
  create: (config: Record<string, unknown>) => createAccordion(config),
  attributes: {
    value: {
      type: "string",
      config: "value",
      update: (c: AccordionComponent, value: AttributeValue) => c.setValue(value === null ? null : String(value)),
    },
    "multi-select": { type: "boolean", config: "multiSelect" },
    variant: { type: "string", config: "variant" },
    density: { type: "string", config: "density" },
    placement: { type: "string", config: "placement" },
    separated: { type: "boolean", config: "separated" },
    disabled: {
      type: "boolean",
      config: "disabled",
      update: (c: AccordionComponent, value: AttributeValue) => void (value ? c.disable() : c.enable()),
    },
  },
  properties: {
    value: { get: (c: AccordionComponent) => c.getValue(), set: (c: AccordionComponent, value: unknown) => void c.setValue(value === null || value === undefined ? null : String(value)), config: "value" },
    values: { get: (c: AccordionComponent) => c.getValues(), set: (c: AccordionComponent, value: unknown) => void c.setValues((value as string[]) ?? []) },
  },
  model: "value" as const,
  methods: [
    "getValue",
    "setValue",
    "getValues",
    "setValues",
    "getPanels",
    "getPanel",
    "addPanel",
    "removePanel",
    "openAll",
    "closeAll",
    "enable",
    "disable",
    "isDisabled",
  ] as const,
  events: { change: {} },
  config: () => ({ panels: [] }),
  setup: (host: ElementHost<AccordionComponent>, component: AccordionComponent) => {
    // The panel children render through a slot, in place
    const slot = slotFor();
    component.element.appendChild(slot);
    // The panel children upgrade after their parent: claim them once the
    // current task's upgrades have run, then apply the authored model
    queueMicrotask(() => {
      claimPanels(host, component);
      const value = host.getAttribute("value");
      if (value !== null) component.setValue(value);
      const values = (host as unknown as { values?: unknown }).values;
      if (Array.isArray(values) && values.length) component.setValues(values as string[]);
    });
    return () => {
      slot.remove();
    };
  },
  // New panel children are claimed without rebuilding the group
  observeChildren: (host: ElementHost<AccordionComponent>, component: AccordionComponent): boolean => {
    claimPanels(host, component);
    return true;
  },
} satisfies ElementSpec<AccordionComponent>;

export type ExpansionPanelSpec = typeof panelSpec;
export type AccordionSpec = typeof accordionSpec;
export const expansionPanelElement = defineElement<ExpansionPanelComponent>(panelSpec);
export const accordionElement = defineElement<AccordionComponent>(accordionSpec);

export type ExpansionPanelElementEventMap = {
  [K in keyof ExpansionPanelEvents]: CustomEvent<K extends "beforeopen" | "beforeclose" ? { value: string } : ExpansionPanelEvents[K] extends (event: infer E) => void ? E : never>;
};

export const expansionPanelEventNames = [
  "beforeopen", "open", "afteropen", "beforeclose", "close", "afterclose", "change",
] as const satisfies readonly (keyof ExpansionPanelElementEventMap)[];

/** `<m-expansion-panel>` as a ref or a query returns it */
export type ExpansionPanelElement = HTMLElement & {
  component: ExpansionPanelComponent | null;
  readonly dirty: boolean;
  open: boolean;
  value: string | null;
  label: string | null;
  supportingText: string | null;
  variant: string | null;
  density: string | null;
  placement: string | null;
  noToggle: boolean;
  leadingIcon: string | null;
  trailingIcon: string | null;
  divider: boolean;
  lazy: boolean;
  error: boolean;
  disabled: boolean;
  headingLevel: number | null;
  ariaLabel: string | null;
  openPanel: () => ExpansionPanelComponent;
  close: () => ExpansionPanelComponent;
  toggle: (force?: boolean) => ExpansionPanelComponent;
  isOpen: () => boolean;
  focus: () => ExpansionPanelComponent;
  enable: () => ExpansionPanelComponent;
  disable: () => ExpansionPanelComponent;
  isDisabled: () => boolean;
};

/** `<m-accordion>` as a ref or a query returns it */
export type AccordionElement = HTMLElement & {
  component: AccordionComponent | null;
  readonly dirty: boolean;
  value: string | null;
  values: string[];
  multiSelect: boolean;
  variant: string | null;
  density: string | null;
  placement: string | null;
  separated: boolean;
  disabled: boolean;
  getValue: () => string | null;
  setValue: (value: string | null) => AccordionComponent;
  getValues: () => string[];
  setValues: (values: string[]) => AccordionComponent;
  getPanels: () => ExpansionPanelComponent[];
  openAll: () => AccordionComponent;
  closeAll: () => AccordionComponent;
};

/** Registers both elements, panels first so an accordion reads them upgraded. */
export const defineExpansionPanel = (options?: DefineOptions): string => {
  const prefix = options?.prefix ?? DEFAULT_PREFIX;
  expansionPanelElement.define(options);
  return accordionElement.define({ ...options, prefix });
};

declare global {
  interface HTMLElementTagNameMap {
    "m-expansion-panel": ExpansionPanelElement;
    "m-accordion": AccordionElement;
  }
}
