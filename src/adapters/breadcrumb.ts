// src/adapters/breadcrumb.ts

import { describe, getPrefix, toAttribute, type ElementProps } from "material/elements";
import {
  breadcrumbElement, defineBreadcrumb,
  type BreadcrumbElement, type BreadcrumbSpec,
} from "../elements/breadcrumb";
import type { BreadcrumbConfig } from "../components/breadcrumb/types";

export interface BreadcrumbBeforeDetail {
  previousValue: string | null;
  value: string;
}

export interface BreadcrumbChangeDetail {
  value: string;
  previousValue: string | null;
}

export type BreadcrumbElementEventMap = {
  beforechange: CustomEvent<BreadcrumbBeforeDetail>;
  change: CustomEvent<BreadcrumbChangeDetail>;
};

export type BreadcrumbProps = {
  [K in keyof ElementProps<BreadcrumbSpec>]: K extends keyof BreadcrumbConfig
    ? BreadcrumbConfig[K]
    : ElementProps<BreadcrumbSpec>[K];
} & {
  modelValue?: string | null;
  onBeforechange?: (event: BreadcrumbElementEventMap["beforechange"]) => void;
  onChange?: (event: BreadcrumbElementEventMap["change"]) => void;
};

export const breadcrumbHost = describe(breadcrumbElement.spec);
export const tag = (): string => `${getPrefix()}-breadcrumb`;
export const breadcrumbEventNames = ["beforechange", "change"] as const;

/** The attribute map: the props that are not properties */
export function attributes(props: object) {
  const result: Record<string, string> = {};
  for (const [key, attribute] of breadcrumbHost.attributes) {
    if (attribute.shadowed) continue;
    const value = toAttribute(attribute.type, (props as Record<string, unknown>)[key]);
    // An absent prop sets nothing
    if (value !== undefined) result[attribute.name] = value;
  }
  return result;
}

export const breadcrumbKeys = [...new Set([...breadcrumbHost.attributes.keys(), ...breadcrumbHost.properties])];

export function hostProps(props: object, excluded: readonly string[] = []) {
  const own = new Set([...breadcrumbKeys, ...excluded]);
  return Object.fromEntries(Object.entries(props).filter(([key]) => !own.has(key)));
}

/** The current item lives on the element's `value` property */
export function synchronizeBreadcrumb(element: BreadcrumbElement, props: BreadcrumbProps): void {
  const wanted = props.modelValue === undefined ? props.value : props.modelValue;
  if (wanted !== undefined && element.value !== wanted) element.value = wanted as string | null;
}

/** The two events, listened for on the host */
export function listenBreadcrumb(
  element: BreadcrumbElement,
  receive: (name: keyof BreadcrumbElementEventMap, event: Event) => void,
) {
  const off = breadcrumbEventNames.map((name) => {
    const handler = (event: Event) => {
      if (event.target === element) receive(name, event);
    };
    element.addEventListener(name, handler);
    return () => element.removeEventListener(name, handler);
  });
  return () => off.forEach((remove) => remove());
}

export { defineBreadcrumb };
