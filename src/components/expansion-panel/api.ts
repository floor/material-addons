// src/components/expansion-panel/api.ts

import type {
  ExpansionPanelComponent,
  ExpansionPanelContent,
  ExpansionPanelParts,
} from "./types";
import type { PanelCore } from "./expansion-panel";
import type { ExpansionPanelSettings } from "./config";
import {
  EXPANSION_PANEL_DENSITIES,
  EXPANSION_PANEL_PLACEMENTS,
  EXPANSION_PANEL_VARIANTS,
  type ExpansionPanelDensity,
  type ExpansionPanelPlacement,
  type ExpansionPanelVariant,
} from "./constants";

interface ApiOptions {
  element: HTMLElement;
  config: ExpansionPanelSettings;
  emit: (event: string, data?: unknown) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  off: (event: string, handler: (...args: unknown[]) => void) => unknown;
  disabled: { enable: () => void; disable: () => void; isDisabled: () => boolean };
  lifecycle: { destroy: () => void };
  panel: PanelCore;
}

export const getApiConfig = (component: unknown): ApiOptions => component as ApiOptions;

const oneOf = <T extends string>(value: unknown, choices: Record<string, T>, fallback: T): T =>
  Object.values(choices).includes(value as T) ? (value as T) : fallback;

/** Adds the public method surface to the composed panel */
export const withAPI =
  (options: ApiOptions) =>
  (component: Record<string, unknown>): ExpansionPanelComponent => {
    const core = options.panel;
    const { on, off, disabled, lifecycle } = options;

    const refresh = (): ExpansionPanelComponent => {
      core.syncHeader();
      return api;
    };

    const api: ExpansionPanelComponent = {
      element: options.element,
      parts: core.header as ExpansionPanelParts,
      header: core.header.header,
      region: core.region.region,
      body: core.region.body,
      open: () => {
        void core.request(true);
        return api;
      },
      close: () => {
        void core.request(false);
        return api;
      },
      toggle: (force?: boolean) => {
        void core.request(force ?? !core.state.open);
        return api;
      },
      isOpen: () => core.state.open,
      setOpen: (open: boolean) => {
        void core.silent(open);
        return api;
      },
      getValue: core.getValue,
      setValue: (value: string) => {
        core.setValue(value);
        return api;
      },
      getLabel: () => core.header.label.textContent ?? "",
      setLabel: (label: string) => {
        core.header.setLabel(label);
        return refresh();
      },
      getSupportingText: () => core.header.supportingText.textContent ?? "",
      setSupportingText: (text: string, isError?: boolean) => {
        core.header.setSupportingText(text);
        if (isError !== undefined) core.state.error = isError;
        return refresh();
      },
      setError: (error: boolean, supportingText?: string) => {
        core.state.error = error;
        if (supportingText !== undefined) core.header.setSupportingText(supportingText);
        return refresh();
      },
      isError: () => core.state.error,
      setVariant: (variant: ExpansionPanelVariant) => {
        core.settings.variant = oneOf(variant, EXPANSION_PANEL_VARIANTS, core.settings.variant);
        return refresh();
      },
      getVariant: () => core.settings.variant,
      setDensity: (density: ExpansionPanelDensity) => {
        core.settings.density = oneOf(density, EXPANSION_PANEL_DENSITIES, core.settings.density);
        return refresh();
      },
      getDensity: () => core.settings.density,
      setPlacement: (placement: ExpansionPanelPlacement) => {
        core.settings.placement = oneOf(placement, EXPANSION_PANEL_PLACEMENTS, core.settings.placement);
        return refresh();
      },
      getPlacement: () => core.settings.placement,
      setContent: (content: ExpansionPanelContent | undefined) => {
        core.region.setContent(content);
        return api;
      },
      setActions: (actions) => {
        core.region.setActions(actions);
        return api;
      },
      enable: () => {
        disabled.enable();
        core.state.disabled = false;
        return refresh();
      },
      disable: () => {
        disabled.disable();
        core.state.disabled = true;
        return refresh();
      },
      isDisabled: () => core.state.disabled,
      focus: () => {
        core.header.header.focus();
        return api;
      },
      on: (event, handler) => {
        on(event, handler as (...args: unknown[]) => void);
        return api;
      },
      off: (event, handler) => {
        off(event, handler as (...args: unknown[]) => void);
        return api;
      },
      destroy: () => {
        lifecycle.destroy();
      },
    };

    const merged = Object.assign(component, api) as unknown as ExpansionPanelComponent;
    core.attach(merged);
    return merged;
  };
