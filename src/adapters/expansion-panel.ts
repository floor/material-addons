// src/adapters/expansion-panel.ts

import { describe, getPrefix, toAttribute, type ElementProps } from "material/elements";
import {
  accordionElement, defineExpansionPanel, expansionPanelElement, expansionPanelEventNames,
  type AccordionElement, type AccordionSpec, type ExpansionPanelElement, type ExpansionPanelElementEventMap,
  type ExpansionPanelSpec,
} from "../elements/expansion-panel";
import type {
  AccordionConfig,
  ExpansionPanelConfig,
} from "../components/expansion-panel/types";

export type ExpansionPanelProps = {
  [K in keyof ElementProps<ExpansionPanelSpec>]: K extends keyof ExpansionPanelConfig
    ? ExpansionPanelConfig[K]
    : ElementProps<ExpansionPanelSpec>[K];
} & {
  onBeforeopen?: (event: ExpansionPanelElementEventMap["beforeopen"]) => void;
  onOpen?: (event: ExpansionPanelElementEventMap["open"]) => void;
  onAfteropen?: (event: ExpansionPanelElementEventMap["afteropen"]) => void;
  onBeforeclose?: (event: ExpansionPanelElementEventMap["beforeclose"]) => void;
  onClose?: (event: ExpansionPanelElementEventMap["close"]) => void;
  onAfterclose?: (event: ExpansionPanelElementEventMap["afterclose"]) => void;
  onChange?: (event: ExpansionPanelElementEventMap["change"]) => void;
};

export type AccordionProps = {
  [K in keyof ElementProps<AccordionSpec>]: K extends keyof AccordionConfig
    ? AccordionConfig[K]
    : ElementProps<AccordionSpec>[K];
} & { modelValue?: string | null; defaultValue?: string | null; 
  onUpdateValue?: (value: string | null) => void;
  onChange?: (event: CustomEvent<{ value: string | null; values: string[]; open: boolean }>) => void;
};

export type ExpansionPanelEventProps = {
  [K in keyof ExpansionPanelElementEventMap as `on${Capitalize<K>}`]?: (event: ExpansionPanelElementEventMap[K]) => void;
};

export const panelHost = describe(expansionPanelElement.spec);
export const accordionHost = describe(accordionElement.spec);
export const tag = (name: "expansion-panel" | "accordion") => `${getPrefix()}-${name}`;
export { expansionPanelEventNames };
export { defineExpansionPanel };

export function attributes(host: typeof panelHost | typeof accordionHost, props: object) {
  const result: Record<string, string | undefined> = {};
  for (const [key, attribute] of host.attributes) {
    result[attribute.name] = toAttribute(attribute.type, (props as Record<string, unknown>)[key]);
  }
  return result;
}

export const panelKeys = [...new Set([...panelHost.attributes.keys(), ...panelHost.properties])];
export const accordionKeys = [...new Set([...accordionHost.attributes.keys(), ...accordionHost.properties, "modelValue", "defaultValue"])];

export function hostProps(host: typeof panelHost | typeof accordionHost, props: object, excluded: readonly string[] = []) {
  const own = new Set([...(host === panelHost ? panelKeys : accordionKeys), ...excluded]);
  return Object.fromEntries(Object.entries(props).filter(([key]) => !own.has(key)));
}

export const panelEventKeys = expansionPanelEventNames.map((name) => `on${name[0]!.toUpperCase()}${name.slice(1)}`);
export const sveltePanelEventKeys = expansionPanelEventNames.map((name) => `on${name}`);

export function listen(
  element: ExpansionPanelElement,
  receive: (name: keyof ExpansionPanelElementEventMap, event: Event) => void,
) {
  const off = expansionPanelEventNames.map((name) => {
    const handler = (event: Event) => {
      if (event.target === element) receive(name, event);
    };
    element.addEventListener(name, handler);
    return () => element.removeEventListener(name, handler);
  });
  return () => off.forEach((remove) => remove());
}

export function listenAccordion(
  element: AccordionElement,
  receive: (name: "change", event: Event) => void,
) {
  const handler = (event: Event) => {
    if (event.target === element) receive("change", event);
  };
  element.addEventListener("change", handler);
  return () => element.removeEventListener("change", handler);
}

export const panelCallback = (name: string): keyof ExpansionPanelEventProps =>
  `on${name[0]!.toUpperCase()}${name.slice(1)}` as keyof ExpansionPanelEventProps;

export function dispatch(props: ExpansionPanelEventProps, name: string, event: Event) {
  const handler = props[panelCallback(name)];
  if (typeof handler === "function") handler(event as never);
}

/** The accordion's live value follows its change, as the stepper's model does */
export function synchronizeAccordion(element: AccordionElement, props: AccordionProps) {
  const wanted = props.modelValue === undefined ? props.value : props.modelValue;
  if (wanted !== undefined && element.value !== wanted) element.value = wanted as string | null;
}
