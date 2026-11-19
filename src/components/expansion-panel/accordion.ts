// src/components/expansion-panel/accordion.ts

import { createBase, pipe, withElement, withEvents, withLifecycle } from "material/core/compose";
import { ACCORDION_EVENTS, EXPANSION_PANEL_EVENTS } from "./constants";
import { createAccordionBaseConfig, getAccordionElementConfig, type AccordionSettings } from "./config";
import { createExpansionPanel } from "./expansion-panel";
import { withAccordionKeyboard } from "./features/withAccordionKeyboard";
import type {
  AccordionChangeEvent,
  AccordionComponent,
  AccordionConfig,
  AccordionEvents,
  ExpansionPanelComponent,
  ExpansionPanelConfig,
} from "./types";

export type { AccordionComponent };

interface AccordionHost {
  element: HTMLElement;
  getClass: (name: string) => string;
  emit: (event: string, data?: unknown) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  off: (event: string, handler: (...args: unknown[]) => void) => unknown;
  lifecycle?: { destroy: () => void };
}

const withAccordionCore =
  (settings: AccordionSettings) =>
  (component: AccordionHost): AccordionHost & { accordion: { panels: ExpansionPanelComponent[] } } => {
    const panels: ExpansionPanelComponent[] = [];
    let coordinating = false;

    const callbacks: Partial<Record<keyof AccordionEvents, (event: never) => void>> = settings.on ?? {};
    const direct: Partial<Record<string, ((event: never) => void) | undefined>> = {
      [ACCORDION_EVENTS.CHANGE]: settings.onChange,
    };
    const emit = <T>(name: string, payload: T): T => {
      component.emit(name, payload as unknown as Record<string, unknown>);
      (callbacks[name as keyof AccordionEvents] as ((event: T) => void) | undefined)?.(payload);
      direct[name]?.(payload as never);
      return payload;
    };

    const valuesOf = (): string[] => panels.filter((panel) => panel.isOpen()).map((panel) => panel.getValue());
    const valueOf = (): string | null => valuesOf()[0] ?? null;

    const positions = (): void => {
      panels.forEach((panel, index) => {
        panel.element.setAttribute(
          "data-mtrl-accordion-item",
          index === 0 ? "first" : index === panels.length - 1 ? "last" : "middle",
        );
      });
    };

    const onPanelChange = (panel: ExpansionPanelComponent, open: boolean): void => {
      if (coordinating) return;
      coordinating = true;
      try {
        if (open && !settings.multiSelect) {
          for (const other of panels) {
            if (other !== panel && other.isOpen()) other.close();
          }
        }
        emit<AccordionChangeEvent>(ACCORDION_EVENTS.CHANGE, {
          component: component as unknown as AccordionComponent,
          value: valueOf(),
          values: valuesOf(),
          panel,
          open,
        });
      } finally {
        coordinating = false;
      }
    };

    const inherit = (config: ExpansionPanelConfig): ExpansionPanelConfig => ({
      variant: settings.variant,
      density: settings.density,
      placement: settings.placement,
      ...config,
    });

    const attachPanel = (panel: ExpansionPanelComponent, index?: number): void => {
      panel.element.setAttribute("data-mtrl-accordion-panel", "");
      if (index === undefined || index >= panels.length) panels.push(panel);
      else panels.splice(index, 0, panel);
      panel.on(EXPANSION_PANEL_EVENTS.CHANGE, (event) => onPanelChange(panel, event.open));
      positions();
      component.element.appendChild(panel.element);
      if (settings.disabled) {
        panel.disable();
        panel.header.disabled = true;
      }
    };

    const isPanel = (entry: ExpansionPanelConfig | ExpansionPanelComponent): entry is ExpansionPanelComponent =>
      typeof (entry as ExpansionPanelComponent).isOpen === "function";
    const build = (entry: ExpansionPanelConfig | ExpansionPanelComponent): ExpansionPanelComponent =>
      isPanel(entry) ? entry : createExpansionPanel(inherit(entry));

    for (const entry of settings.panels ?? []) attachPanel(build(entry));

    const keyboardOff = withAccordionKeyboard(component.element, () => panels.map((panel) => panel.header));

    const apply = (values: string[]): void => {
      const wanted = new Set(values);
      coordinating = true;
      try {
        for (const panel of panels) {
          if (wanted.has(panel.getValue())) {
            if (!panel.isOpen()) void (panel as unknown as { setOpen: (open: boolean) => void }).setOpen(true);
          } else if (panel.isOpen()) {
            void (panel as unknown as { setOpen: (open: boolean) => void }).setOpen(false);
          }
        }
      } finally {
        coordinating = false;
      }
    };

    const initial = settings.multiSelect
      ? settings.values ?? []
      : settings.value ? [settings.value] : [];
    if (initial.length) apply(initial);

    const originalDestroy = component.lifecycle?.destroy?.bind(component.lifecycle);
    if (component.lifecycle && originalDestroy) {
      component.lifecycle.destroy = () => {
        keyboardOff();
        for (const panel of panels) panel.destroy();
        originalDestroy();
      };
    }

    return {
      ...component,
      accordion: { panels },
    };
  };

const withAccordionAPI =
  (settings: AccordionSettings) =>
  (component: AccordionHost & { accordion: { panels: ExpansionPanelComponent[] } }): AccordionComponent => {
    const panels = (): ExpansionPanelComponent[] => component.accordion.panels;
    // The host's own listeners, taken before the API's `on`/`off` land on it
    const hostOn = component.on;
    const hostOff = component.off;
    const values = (): string[] => panels().filter((panel) => panel.isOpen()).map((panel) => panel.getValue());
    const find = (valueOrIndex: string | number): ExpansionPanelComponent | null =>
      typeof valueOrIndex === "number"
        ? panels()[valueOrIndex] ?? null
        : panels().find((panel) => panel.getValue() === valueOrIndex) ?? null;

    const setOpen = (panel: ExpansionPanelComponent, open: boolean): void =>
      void (panel as unknown as { setOpen: (open: boolean) => void }).setOpen(open);

    const api: AccordionComponent = {
      element: component.element,
      getValue: () => values()[0] ?? null,
      setValue: (value: string | null) => {
        const wanted = value === null ? [] : [value];
        const current = new Set(values());
        for (const panel of panels()) {
          const shouldOpen = wanted.includes(panel.getValue());
          if (shouldOpen !== current.has(panel.getValue())) setOpen(panel, shouldOpen);
        }
        return api;
      },
      getValues: values,
      setValues: (next: string[]) => {
        const current = new Set(values());
        for (const panel of panels()) {
          const shouldOpen = next.includes(panel.getValue());
          if (shouldOpen !== current.has(panel.getValue())) setOpen(panel, shouldOpen);
        }
        return api;
      },
      getPanels: () => [...panels()],
      getPanel: find,
      addPanel: (entry, index) => {
        const panel = typeof (entry as ExpansionPanelComponent).isOpen === "function"
          ? (entry as ExpansionPanelComponent)
          : createExpansionPanel({ ...(entry as ExpansionPanelConfig) });
        const at = index === undefined ? panels().length : Math.max(0, Math.min(index, panels().length));
        if (at >= panels().length) panels().push(panel);
        else panels().splice(at, 0, panel);
        panel.element.setAttribute("data-mtrl-accordion-panel", "");
        // A panel built by an element already renders in that element's own
        // shadow root: only a factory-built panel is moved into this one
        if (!panel.element.isConnected) component.element.appendChild(panel.element);
        return api;
      },
      removePanel: (valueOrIndex) => {
        const panel = find(valueOrIndex);
        if (!panel) return api;
        component.accordion.panels = panels().filter((candidate) => candidate !== panel);
        panel.element.remove();
        panel.destroy();
        return api;
      },
      openAll: () => {
        for (const panel of panels()) if (!panel.isDisabled()) setOpen(panel, true);
        return api;
      },
      closeAll: () => {
        for (const panel of panels()) setOpen(panel, false);
        return api;
      },
      enable: () => {
        settings.disabled = false;
        for (const panel of panels()) panel.enable();
        return api;
      },
      disable: () => {
        settings.disabled = true;
        for (const panel of panels()) panel.disable();
        return api;
      },
      isDisabled: () => settings.disabled,
      on: (event, handler) => {
        hostOn(event, handler as (...args: unknown[]) => void);
        return api;
      },
      off: (event, handler) => {
        hostOff(event, handler as (...args: unknown[]) => void);
        return api;
      },
      destroy: () => {
        component.lifecycle?.destroy?.();
      },
    };
    return Object.assign(component, api) as unknown as AccordionComponent;
  };

export const createAccordion = (config: AccordionConfig = {}): AccordionComponent => {
  const settings = createAccordionBaseConfig(config);
  const built = pipe(
    createBase,
    withEvents(),
    withElement(getAccordionElementConfig(settings)),
    withLifecycle(),
    withAccordionCore(settings),
  )(settings as never) as AccordionHost & { accordion: { panels: ExpansionPanelComponent[] } };
  const withMethods = withAccordionAPI(settings)(built);
  // The change event reaches the element host once the public component is in
  // place; panels created before it keep their own callbacks
  return withMethods;
};

export default createAccordion;
