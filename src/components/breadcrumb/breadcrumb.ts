// src/components/breadcrumb/breadcrumb.ts

/**
 * The breadcrumb: a trail of ancestor links with the current page as the last
 * item. Material Design 3 publishes no breadcrumb; the landmark, the ordered
 * list and `aria-current="page"` follow the WAI-ARIA breadcrumb pattern, and
 * the overflow menu uses Material's menu surface and a standard icon button.
 *
 * The model is `value`, the stable id of the current item, which is always
 * the last item in the trail. The component does not rewrite the trail when
 * an ancestor is activated: the caller sets the new one.
 */

import { createBase, pipe, withDisabled, withElement, withEvents, withLifecycle } from "material/core/compose";
import { BREADCRUMB_EVENTS, BREADCRUMB_MODIFIERS } from "./constants";
import { createBaseConfig, getElementConfig, type BreadcrumbSettings } from "./config";
import { withCollapse, type CollapseFeature } from "./features/withCollapse";
import { withTrail, type TrailFeature } from "./features/withTrail";
import { getApiConfig, withAPI } from "./api";
import type {
  BreadcrumbBeforeChangeEvent,
  BreadcrumbChangeEvent,
  BreadcrumbComponent,
  BreadcrumbConfig,
  BreadcrumbEvents,
  BreadcrumbItemConfig,
  BreadcrumbItemState,
} from "./types";

export type { BreadcrumbComponent };

/** What the API and the element read from the breadcrumb */
export interface BreadcrumbCore {
  settings: BreadcrumbSettings;
  state: { items: BreadcrumbItemState[]; value: string | null; disabled: boolean };
  trail: TrailFeature;
  collapse: CollapseFeature;
  setItems: (items: BreadcrumbItemConfig[]) => void;
  setValue: (value: string | null) => void;
  getItem: (value: string) => BreadcrumbItemState | null;
  goTo: (value: string) => boolean;
  /** Every committed or silent state change, for the element */
  stateListeners: Array<() => void>;
  destroy: () => void;
}

interface BreadcrumbHost {
  element: HTMLElement;
  getClass: (name: string) => string;
  emit: (event: string, data?: unknown) => void;
  disabled: { enable: () => void; disable: () => void; isDisabled: () => boolean };
}

const normalize = (items: BreadcrumbItemConfig[]): BreadcrumbItemState[] =>
  items.map((item, index) => ({
    value: item.value ?? `crumb-${index}`,
    label: item.label ?? "",
    index,
    href: item.href,
    disabled: item.disabled === true,
    current: index === items.length - 1,
  }));

const withBreadcrumbCore =
  (settings: BreadcrumbSettings) =>
  (component: BreadcrumbHost): BreadcrumbHost & { breadcrumb: BreadcrumbCore } => {
    const state = {
      items: normalize(settings.items ?? []),
      value: (settings.items?.length ? normalize(settings.items).at(-1)!.value : null) as string | null,
      disabled: settings.disabled === true || component.disabled.isDisabled(),
    };
    const stateListeners: Array<() => void> = [];

    const callbacks: Partial<Record<keyof BreadcrumbEvents, (event: never) => void>> = settings.on ?? {};
    const direct: Partial<Record<string, ((event: never) => void) | undefined>> = {
      [BREADCRUMB_EVENTS.BEFORE_CHANGE]: settings.onBeforeChange,
      [BREADCRUMB_EVENTS.CHANGE]: settings.onChange,
    };
    const emit = <T>(name: string, payload: T): T => {
      component.emit(name, payload as unknown as Record<string, unknown>);
      (callbacks[name as keyof BreadcrumbEvents] as ((event: T) => void) | undefined)?.(payload);
      direct[name]?.(payload as never);
      return payload;
    };

    const render = (): void => {
      trail.render(state.items, state.value, state.disabled);
      component.element.classList.toggle(component.getClass(BREADCRUMB_MODIFIERS.DISABLED), state.disabled);
      collapse.measure(state.items, state.value, state.disabled);
      stateListeners.forEach((listener) => listener());
    };

    const trail = withTrail(settings, component.getClass, (value) => goTo(value));
    const collapse = withCollapse(
      settings, component.getClass, component.element, trail,
      (value) => goTo(value), () => ({ value: state.value, disabled: state.disabled }),
    );
    component.element.append(trail.element, collapse.element);

    const ask = (item: BreadcrumbItemState): boolean => {
      let prevented = false;
      const payload: BreadcrumbBeforeChangeEvent = {
        previousValue: state.value,
        value: item.value,
        previousItem: state.items.find((candidate) => candidate.value === state.value) ?? null,
        item,
        preventDefault: () => {
          prevented = true;
        },
        get defaultPrevented() {
          return prevented;
        },
      };
      emit(BREADCRUMB_EVENTS.BEFORE_CHANGE, payload);
      return !prevented;
    };

    const goTo = (value: string): boolean => {
      if (state.disabled) return false;
      const item = state.items.find((candidate) => candidate.value === value);
      if (!item || item.disabled || item.current || item.value === state.value) return false;
      if (!ask(item)) return false;
      const previousValue = state.value;
      const previousItem = state.items.find((candidate) => candidate.value === previousValue) ?? null;
      const detail: BreadcrumbChangeEvent = { value: item.value, previousValue, item, previousItem };
      emit(BREADCRUMB_EVENTS.CHANGE, detail);
      return true;
    };

    const setItems = (items: BreadcrumbItemConfig[]): void => {
      state.items = normalize(items);
      state.value = state.items.at(-1)?.value ?? null;
      render();
    };

    const setValue = (value: string | null): void => {
      if (value === null) {
        if (state.items.length) return;
        state.value = null;
        render();
        return;
      }
      const last = state.items.at(-1);
      if (last && last.value === value) {
        state.value = value;
        render();
      }
    };

    render();

    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => collapse.measure(state.items, state.value, state.disabled))
      : undefined;
    observer?.observe(component.element);

    const core: BreadcrumbCore = {
      settings,
      state,
      trail,
      collapse,
      setItems,
      setValue,
      getItem: (value) => state.items.find((item) => item.value === value) ?? null,
      goTo,
      stateListeners,
      destroy: () => {
        observer?.disconnect();
        collapse.destroy();
        stateListeners.length = 0;
      },
    };
    return { ...component, breadcrumb: core };
  };

export const createBreadcrumb = (config: BreadcrumbConfig = {}): BreadcrumbComponent => {
  const settings = createBaseConfig(config);
  const built = pipe(
    createBase,
    withEvents(),
    withElement(getElementConfig(settings)),
    withDisabled(settings),
    withLifecycle(),
    withBreadcrumbCore(settings),
  )(settings as never) as BreadcrumbHost & { breadcrumb: BreadcrumbCore };
  return withAPI(getApiConfig(built))(built as unknown as Record<string, unknown>) as unknown as BreadcrumbComponent;
};

export default createBreadcrumb;
