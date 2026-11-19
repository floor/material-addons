"use client";

// The skeleton's framework adapters, from the element contract. The skeleton
// has no events and no model: each adapter defines the element, keeps the
// authored attributes in sync, and forwards nothing else.

import { describe, getPrefix, toAttribute, type DefaultProps, type ElementProps } from "material/elements";
import { skeletonElement, type SkeletonElement, type SkeletonSpec } from "../elements/skeleton";
import type { SkeletonConfig } from "../components/skeleton/types";

type ElementSkeletonProps = ElementProps<SkeletonSpec>;
/** The element chooses the prop names. The factory narrows its option values. */
export type SkeletonProps = {
  [K in keyof ElementSkeletonProps]: K extends keyof SkeletonConfig ? SkeletonConfig[K] : ElementSkeletonProps[K];
} & {
  [K in keyof DefaultProps<SkeletonSpec>]: DefaultProps<SkeletonSpec>[K] | null;
};
export type SkeletonEventProps = Record<string, never>;

export const skeletonHost = describe(skeletonElement.spec);
export const tag = () => `${getPrefix()}-skeleton`;

/** The authored props as attributes; a null or undefined prop is omitted. */
export function attributes(props: object): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, attribute] of skeletonHost.attributes) {
    const value = (props as Record<string, unknown>)[key];
    if (value != null) result[attribute.name] = toAttribute(attribute.type, value);
  }
  return result;
}

/** Define the element, then apply the live props. */
export function initialize(element: SkeletonElement, props: SkeletonProps) {
  void element.component; // the shared definition creates it on upgrade
  for (const [key, value] of Object.entries(attributes(props))) {
    if (value !== undefined) element.setAttribute(key, value);
  }
}

/** Keep the authored attributes in sync across re-renders. */
export function synchronize(element: SkeletonElement, props: SkeletonProps) {
  const next = attributes(props);
  for (const [key, attribute] of skeletonHost.attributes) {
    const value = next[attribute.name];
    if (value === undefined) element.removeAttribute(attribute.name);
    else if (element.getAttribute(attribute.name) !== value) element.setAttribute(attribute.name, value);
  }
}

export type { DefaultProps };

/** The props a host element takes after the skeleton's own are spoken for. */
export function passthrough(props: Record<string, unknown>): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...props };
  for (const [key] of skeletonHost.attributes) delete rest[key];
  delete rest.className;
  delete rest.children;
  return rest;
}
