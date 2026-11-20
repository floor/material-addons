// src/elements/paginator.ts
/**
 * `<m-paginator>`: the paginator as a custom element.
 *
 * Client only: server rendering of the element is deferred until `material`'s
 * renderer accepts another package's specs. The model (page, page size,
 * total) is settable through attributes and properties without events; the
 * one event the element dispatches is a cancelable `change`, raised from the
 * factory's `beforechange` so a listener vetoes the move before it commits.
 *
 * @module elements
 */

import {
  defineElement,
  type AttributeSpec,
  type DefineOptions,
  type ElementHost,
  type ElementInstance,
  type ElementSpec,
} from "material/elements";
import { createPaginator } from "../components/paginator";
import type {
  PaginatorComponent,
  PaginatorConfig,
} from "../components/paginator/types";

type Component = PaginatorComponent;
type AttributeValue = Parameters<NonNullable<AttributeSpec<Component>["update"]>>[1];

const number = (value: AttributeValue, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const paginatorSpec = {
  name: "paginator",
  ssr: false,
  styles: ["paginator"],
  hostStyles: ":host{display:block}",
  create: (config: Record<string, unknown>) => createPaginator(config as PaginatorConfig),
  attributes: {
    page: {
      type: "number",
      config: "page",
      update: (c: Component, value: AttributeValue) => {
        if (number(value, 1) !== c.getPage()) c.setPage(number(value, 1));
      },
    },
    "page-size": {
      type: "number",
      config: "pageSize",
      update: (c: Component, value: AttributeValue) => {
        if (number(value, 25) !== c.getPageSize()) c.setPageSize(number(value, 25));
      },
    },
    total: {
      type: "number",
      config: "total",
      update: (c: Component, value: AttributeValue) => {
        if (number(value, 0) !== c.getTotal()) c.setTotal(number(value, 0));
      },
    },
    numbered: {
      type: "boolean",
      config: "numbered",
      update: (c: Component, value: AttributeValue) => c.setNumbered(!!value),
    },
    disabled: {
      type: "boolean",
      config: "disabled",
      update: (c: Component, value: AttributeValue) => void (value ? c.disable() : c.enable()),
    },
    // These shape the created component: a change rebuilds it, which re-reads
    // the authored labels and counts
    "sibling-count": { type: "number", config: "siblingCount" },
    "boundary-count": { type: "number", config: "boundaryCount" },
    "no-ends": { type: "boolean" },
    "aria-label": { type: "string", config: "ariaLabel" },
    "page-size-label": { type: "string", config: "pageSizeLabel" },
    "first-label": { type: "string", config: "firstLabel" },
    "prev-label": { type: "string", config: "prevLabel" },
    "next-label": { type: "string", config: "nextLabel" },
    "last-label": { type: "string", config: "lastLabel" },
  },
  properties: {
    pageSizes: {
      get: (c: Component) => c.getPageSizes(),
      set: (c: Component, value: unknown) => void c.setPageSizes((value as number[]) ?? []),
    },
  },
  methods: [
    "getPage",
    "setPage",
    "getPageSize",
    "setPageSize",
    "getPageSizes",
    "setPageSizes",
    "getTotal",
    "setTotal",
    "getPageCount",
    "getRange",
    "goTo",
    "setNumbered",
    "enable",
    "disable",
    "isDisabled",
  ] as const,
  // The authored opt-out is presence: first and last are on unless `no-ends`
  config: (host: HTMLElement) => ({ ends: !host.hasAttribute("no-ends") }),
  setup: (host: ElementHost<Component>, component: Component) => {
    // The cancelable event: raised before the model commits, and cancelling
    // it vetoes the factory's beforechange
    const bridge = (payload: unknown) => {
      const detail = payload as { page: number; pageSize: number; preventDefault: () => void };
      const event = new CustomEvent("change", {
        detail: { page: detail.page, pageSize: detail.pageSize },
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      host.dispatchEvent(event);
      if (event.defaultPrevented) detail.preventDefault();
    };
    component.on("beforechange", bridge as never);
    // The model reflects on the host, silent writes included
    const reflect = (): void => {
      const write = (name: string, value: number): void => {
        if (host.getAttribute(name) !== String(value)) host.setAttribute(name, String(value));
      };
      write("page", component.getPage());
      write("page-size", component.getPageSize());
      write("total", component.getTotal());
      if (host.hasAttribute("disabled") !== component.isDisabled()) host.toggleAttribute("disabled", component.isDisabled());
    };
    const paginator = (component as unknown as { paginator?: { stateListeners: Array<() => void> } }).paginator;
    paginator?.stateListeners.push(reflect);
    reflect();
    return () => {
      component.off("beforechange", bridge as never);
      const at = paginator ? paginator.stateListeners.indexOf(reflect) : -1;
      if (paginator && at !== -1) paginator.stateListeners.splice(at, 1);
    };
  },
} satisfies ElementSpec<Component>;

export const paginatorElement = defineElement<Component>(paginatorSpec);
export type PaginatorSpec = typeof paginatorSpec;

/** Registers `<m-paginator>`. */
export const definePaginator = (options: DefineOptions = {}): string => paginatorElement.define(options);

/** `<m-paginator>` as a ref or a query returns it. */
export type PaginatorElement = ElementInstance<PaginatorSpec, Component> & {
  pageSizes: number[];
  goTo(page: number): boolean;
  setPage(page: number): PaginatorComponent;
  setPageSize(pageSize: number): PaginatorComponent;
  setPageSizes(pageSizes: number[]): PaginatorComponent;
  setTotal(total: number): PaginatorComponent;
  getPage(): number;
  getPageSize(): number;
  getPageSizes(): number[];
  getTotal(): number;
  getPageCount(): number;
  setNumbered(numbered: boolean): PaginatorComponent;
};
