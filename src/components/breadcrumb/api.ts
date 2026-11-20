// src/components/breadcrumb/api.ts

import type { BreadcrumbCore } from "./breadcrumb";
import type { BreadcrumbComponent } from "./types";

interface ApiOptions {
  element: HTMLElement;
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  off: (event: string, handler: (...args: unknown[]) => void) => unknown;
  disabled: { enable: () => void; disable: () => void; isDisabled: () => boolean };
  lifecycle: { destroy: () => void };
  breadcrumb: BreadcrumbCore;
}

export const getApiConfig = (component: unknown): ApiOptions => component as ApiOptions;

/** Adds the public method surface to the composed breadcrumb */
export const withAPI =
  (options: ApiOptions) =>
  (component: Record<string, unknown>): BreadcrumbComponent => {
    const core = options.breadcrumb;
    const { on, off, disabled, lifecycle } = options;
    const self = (): BreadcrumbComponent => component as unknown as BreadcrumbComponent;

    const api: BreadcrumbComponent = {
      element: options.element,
      getValue: () => core.state.value,
      setValue: (value) => {
        core.setValue(value);
        return self();
      },
      getItems: () => [...core.state.items],
      setItems: (items) => {
        core.setItems(items);
        return self();
      },
      getItem: core.getItem,
      goTo: (value) => core.goTo(value),
      open: () => {
        core.collapse.open();
        return self();
      },
      close: () => {
        core.collapse.close();
        return self();
      },
      isOpen: () => core.collapse.isOpen(),
      enable: () => {
        disabled.enable();
        core.state.disabled = false;
        core.setItems(core.state.items);
        return self();
      },
      disable: () => {
        disabled.disable();
        core.state.disabled = true;
        core.setItems(core.state.items);
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
      destroy: () => {
        lifecycle.destroy();
        core.destroy();
      },
    };
    return Object.assign(component, api) as unknown as BreadcrumbComponent;
  };
