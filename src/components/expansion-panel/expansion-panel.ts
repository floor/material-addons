// src/components/expansion-panel/expansion-panel.ts

import { createBase, pipe, withDisabled, withElement, withEvents, withLifecycle } from "material/core/compose";
import { EXPANSION_PANEL_EVENTS } from "./constants";
import { createBaseConfig, getElementConfig, type ExpansionPanelSettings } from "./config";
import { getApiConfig, withAPI } from "./api";
import { withHeader, type HeaderFeature } from "./features/withHeader";
import { withRegion, type RegionFeature } from "./features/withRegion";
import type {
  ExpansionPanelBeforeEvent,
  ExpansionPanelComponent,
  ExpansionPanelConfig,
  ExpansionPanelEvent,
  ExpansionPanelEvents,
} from "./types";

export type { ExpansionPanelComponent };

/** What the API and the accordion read from a panel */
export interface PanelCore {
  settings: ExpansionPanelSettings;
  state: { open: boolean; error: boolean; disabled: boolean };
  header: HeaderFeature;
  region: RegionFeature;
  /** The public component, attached by withAPI */
  attach: (component: ExpansionPanelComponent) => void;
  /** Runs the vetoable transition; resolves true when the panel changed */
  request: (open: boolean) => Promise<boolean>;
  /** Applies a state without events */
  silent: (open: boolean) => Promise<void>;
  syncHeader: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  /**
   * Runs after the before-events allow an opening and before the panel
   * opens; returning false cancels it. The accordion closes the others here,
   * so a listener's veto arrives before anything else changes.
   */
  guards: Array<(open: boolean) => boolean>;
}

interface PanelHost {
  element: HTMLElement;
  getClass: (name: string) => string;
  emit: (event: string, data?: unknown) => void;
  disabled: { enable: () => void; disable: () => void; isDisabled: () => boolean };
}

const withPanelCore =
  (settings: ExpansionPanelSettings) =>
  (component: PanelHost): PanelHost & { panel: PanelCore } => {
    const state = { open: settings.open === true, error: settings.error === true, disabled: settings.disabled === true };
    let value = settings.value ?? "panel-1";
    let self: ExpansionPanelComponent | null = null;
    const host = component as unknown as ExpansionPanelComponent;

    const callbacks: Partial<Record<keyof ExpansionPanelEvents, (event: never) => void>> = settings.on ?? {};
    const direct: Partial<Record<string, ((event: never) => void) | undefined>> = {
      [EXPANSION_PANEL_EVENTS.BEFORE_OPEN]: settings.onBeforeOpen,
      [EXPANSION_PANEL_EVENTS.OPEN]: settings.onOpen,
      [EXPANSION_PANEL_EVENTS.AFTER_OPEN]: settings.onAfterOpen,
      [EXPANSION_PANEL_EVENTS.BEFORE_CLOSE]: settings.onBeforeClose,
      [EXPANSION_PANEL_EVENTS.CLOSE]: settings.onClose,
      [EXPANSION_PANEL_EVENTS.AFTER_CLOSE]: settings.onAfterClose,
      [EXPANSION_PANEL_EVENTS.CHANGE]: settings.onChange,
    };

    const emit = <T>(name: string, payload: T): T => {
      component.emit(name, payload as unknown as Record<string, unknown>);
      (callbacks[name as keyof ExpansionPanelEvents] as ((event: T) => void) | undefined)?.(payload);
      direct[name]?.(payload as never);
      return payload;
    };

    const ask = (name: string): boolean => {
      let prevented = false;
      const payload = {
        component: self ?? host,
        value,
        preventDefault: () => {
          prevented = true;
        },
        get defaultPrevented() {
          return prevented;
        },
      } as ExpansionPanelBeforeEvent;
      emit(name, payload);
      return !prevented;
    };

    const guards: Array<(open: boolean) => boolean> = [];
    const header = withHeader(settings)(component);
    const region = withRegion(settings)(component, header, () => self ?? host);

    const payload = (): ExpansionPanelEvent => ({ component: self ?? host, value, open: state.open });

    const syncHeader = (): void => {
      header.sync({ open: state.open, error: state.error, disabled: state.disabled });
    };

    const silent = async (open: boolean): Promise<void> => {
      if (state.open !== open) {
        state.open = open;
        syncHeader();
        await region.apply(open, true);
        return;
      }
      syncHeader();
    };

    const request = async (open: boolean): Promise<boolean> => {
      if (state.open === open || state.disabled) return false;
      if (!ask(open ? EXPANSION_PANEL_EVENTS.BEFORE_OPEN : EXPANSION_PANEL_EVENTS.BEFORE_CLOSE)) return false;
      if (open && !guards.every((guard) => guard(true))) return false;
      state.open = open;
      syncHeader();
      // The region is in its new state before the event describes it: an
      // `open` listener sees the content, not a hidden inert region
      const settled = region.apply(open);
      // The after-event describes the transition that settles, even if
      // another request changed the state before it did
      const done = payload();
      emit(open ? EXPANSION_PANEL_EVENTS.OPEN : EXPANSION_PANEL_EVENTS.CLOSE, payload());
      emit(EXPANSION_PANEL_EVENTS.CHANGE, payload());
      void settled.then(() => {
        emit(open ? EXPANSION_PANEL_EVENTS.AFTER_OPEN : EXPANSION_PANEL_EVENTS.AFTER_CLOSE, done);
      });
      return true;
    };

    component.element.addEventListener("click", (event) => {
      if (event.composedPath().includes(header.header)) void (state.open ? request(false) : request(true));
    });

    if (state.open) {
      syncHeader();
      region.region.hidden = false;
      region.region.inert = false;
      void region.apply(true, true);
    } else {
      syncHeader();
      region.region.hidden = true;
      region.region.inert = true;
    }

    const core: PanelCore = {
      settings,
      state,
      header,
      region,
      attach: (component) => {
        self = component;
      },
      request,
      silent,
      syncHeader,
      getValue: () => value,
      setValue: (next) => {
        value = next;
      },
      guards,
    };

    return { ...component, panel: core };
  };

export const createExpansionPanel = (config: ExpansionPanelConfig = {}): ExpansionPanelComponent => {
  const settings = createBaseConfig(config);
  const built = pipe(
    createBase,
    withEvents(),
    withElement(getElementConfig(settings)),
    withDisabled(settings),
    withLifecycle(),
    withPanelCore(settings),
  )(settings as never) as PanelHost & { panel: PanelCore };
  return withAPI(getApiConfig(built))(built as unknown as Record<string, unknown>) as unknown as ExpansionPanelComponent;
};

export default createExpansionPanel;
