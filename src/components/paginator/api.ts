// src/components/paginator/api.ts

import type { PaginatorCore } from "./paginator";
import type { PaginatorComponent, PaginatorEvents } from "./types";

interface ApiOptions {
  element: HTMLElement;
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  off: (event: string, handler: (...args: unknown[]) => void) => unknown;
  disabled: { enable: () => void; disable: () => void; isDisabled: () => boolean };
  lifecycle: { destroy: () => void };
  paginator: PaginatorCore;
}

export const getApiConfig = (component: unknown): ApiOptions => component as ApiOptions;

/** Adds the public method surface to the composed paginator */
export const withAPI =
  (options: ApiOptions) =>
  (component: Record<string, unknown>): PaginatorComponent => {
    const core = options.paginator;
    const { on, off, disabled, lifecycle } = options;

    // The fluent methods return the object the factory hands out
    const self = (): PaginatorComponent => component as unknown as PaginatorComponent;
    const api: PaginatorComponent = {
      element: options.element,
      select: core.select,
      range: core.range,
      getPage: () => core.state.page,
      setPage: (page) => {
        core.setPage(page);
        return self();
      },
      getPageSize: () => core.state.pageSize,
      setPageSize: (pageSize) => {
        core.setPageSize(pageSize);
        return self();
      },
      getPageSizes: () => [...core.settings.pageSizes],
      setPageSizes: (pageSizes) => {
        core.setPageSizes(pageSizes);
        return self();
      },
      getTotal: () => core.state.total,
      setTotal: (total) => {
        core.setTotal(total);
        return self();
      },
      getPageCount: core.getPageCount,
      getRange: core.getRange,
      goTo: (page) => core.goTo(page),
      setNumbered: (numbered) => {
        core.setNumbered(numbered);
        return self();
      },
      enable: () => {
        disabled.enable();
        core.state.disabled = false;
        core.setPage(core.state.page);
        return self();
      },
      disable: () => {
        disabled.disable();
        core.state.disabled = true;
        core.setPage(core.state.page);
        return self();
      },
      isDisabled: () => core.state.disabled,
      on: (event, handler) => {
        on(event, handler as (...args: unknown[]) => void);
        return self();
      },
      off: (event, handler) => {
        off(event, handler as (...args: unknown[]) => void);
        return self();
      },
      destroy: () => core.destroy(),
    };
    return Object.assign(component, api) as unknown as PaginatorComponent;
  };
