// src/adapters/paginator.ts

import { describe, getPrefix, toAttribute, type ElementProps } from "material/elements";
import {
  definePaginator, paginatorElement,
  type PaginatorElement, type PaginatorSpec,
} from "../elements/paginator";
import type { PaginatorConfig } from "../components/paginator/types";

/** The cancelable element `change` detail: the proposed page pair, before commit. */
export interface PaginatorChangeDetail {
  page: number;
  pageSize: number;
}

export type PaginatorElementEventMap = { change: CustomEvent<PaginatorChangeDetail> };

export type PaginatorProps = {
  [K in keyof ElementProps<PaginatorSpec>]: K extends keyof PaginatorConfig
    ? PaginatorConfig[K]
    : ElementProps<PaginatorSpec>[K];
} & {
  onChange?: (event: PaginatorElementEventMap["change"]) => void;
};

export const paginatorHost = describe(paginatorElement.spec);
export const tag = (): string => `${getPrefix()}-paginator`;
export const paginatorEventNames = ["change"] as const;

/** The attribute map: the props that are not properties */
export function attributes(props: object) {
  const result: Record<string, string> = {};
  for (const [key, attribute] of paginatorHost.attributes) {
    if (attribute.shadowed) continue;
    const value = toAttribute(attribute.type, (props as Record<string, unknown>)[key]);
    // An absent prop sets nothing
    if (value !== undefined) result[attribute.name] = value;
  }
  return result;
}

export const paginatorKeys = [...new Set([...paginatorHost.attributes.keys(), ...paginatorHost.properties])];

export function hostProps(props: object, excluded: readonly string[] = []) {
  const own = new Set([...paginatorKeys, ...excluded]);
  return Object.fromEntries(Object.entries(props).filter(([key]) => !own.has(key)));
}

/** The model lives on the element's properties, not its attributes */
export function synchronizePaginator(element: PaginatorElement, props: PaginatorProps): void {
  if (props.pageSize !== undefined) element.setPageSize(props.pageSize);
  if (props.total !== undefined) element.setTotal(props.total);
  if (props.page !== undefined) element.setPage(props.page);
  if (props.pageSizes !== undefined) element.pageSizes = props.pageSizes;
}

/** The one event: the cancelable proposal, listened for on the host */
export function listenPaginator(element: PaginatorElement, receive: (event: Event) => void) {
  const handler = (event: Event) => {
    if (event.target === element) receive(event);
  };
  element.addEventListener("change", handler);
  return () => element.removeEventListener("change", handler);
}

export { definePaginator };
