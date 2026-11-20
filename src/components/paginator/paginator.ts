// src/components/paginator/paginator.ts

/**
 * The paginator: a rows-per-page select, the live range line, and the page
 * navigation. It composes into the data grid, which sets `page`, `pageSize`,
 * `pageSizes` and `total` and listens for the cancelable element `change`.
 *
 * The paginator is an exception the naming guide records: `page` is a
 * positional model, like carousel `index`, not `value`. `setPage` is the
 * silent setter; `goTo` is the guarded command that the controls call.
 */

import { createBase, pipe, withDisabled, withElement, withEvents, withLifecycle } from "material/core/compose";
import { PAGINATOR_CLASSES, PAGINATOR_DEFAULTS, PAGINATOR_EVENTS, PAGINATOR_MODIFIERS } from "./constants";
import { createBaseConfig, getElementConfig, type PaginatorSettings } from "./config";
import { withNavigation, type NavigationFeature } from "./features/withNavigation";
import { withNumberedPages, type NumberedPagesFeature } from "./features/withNumberedPages";
import { withPageSize, type PageSizeFeature } from "./features/withPageSize";
import { getApiConfig, withAPI } from "./api";
import type {
  PaginatorBeforeChangeEvent,
  PaginatorChangeEvent,
  PaginatorComponent,
  PaginatorConfig,
  PaginatorEvents,
  PaginatorRange,
} from "./types";

export type { PaginatorComponent };

/** What the API, the element and the features read from the paginator */
export interface PaginatorCore {
  settings: PaginatorSettings;
  state: { page: number; pageSize: number; total: number; disabled: boolean };
  pageSize: PageSizeFeature;
  navigation: NavigationFeature;
  numbered: NumberedPagesFeature;
  select: HTMLSelectElement;
  range: HTMLElement;
  /** The guarded move; emits beforechange, then change when it commits */
  goTo: (page: number) => boolean;
  /** Silent writes: model and DOM, no events */
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setPageSizes: (pageSizes: number[]) => void;
  setTotal: (total: number) => void;
  setNumbered: (numbered: boolean) => void;
  getPageSizes: () => number[];
  getPageCount: () => number;
  getRange: () => PaginatorRange;
  /** Every committed state change, silent ones included, for the element */
  stateListeners: Array<() => void>;
  destroy: () => void;
}

interface PaginatorHost {
  element: HTMLElement;
  getClass: (name: string) => string;
  emit: (event: string, data?: unknown) => void;
  disabled: { enable: () => void; disable: () => void; isDisabled: () => boolean };
}

const positive = (value: unknown): number | undefined => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 ? Math.floor(number) : undefined;
};

let instance = 0;
const nextId = (): string => `mtrl-paginator-${++instance}`;

const withPaginationCore =
  (settings: PaginatorSettings) =>
  (component: PaginatorHost): PaginatorHost & { paginator: PaginatorCore } => {
    const state = {
      page: positive(settings.page) ?? PAGINATOR_DEFAULTS.PAGE,
      pageSize: positive(settings.pageSize) ?? PAGINATOR_DEFAULTS.PAGE_SIZE,
      total: Number.isFinite(Number(settings.total)) ? Math.max(0, Math.floor(Number(settings.total))) : 0,
      disabled: settings.disabled === true || component.disabled.isDisabled(),
    };
    let pageSizes = [...settings.pageSizes];
    const stateListeners: Array<() => void> = [];

    const callbacks: Partial<Record<keyof PaginatorEvents, (event: never) => void>> = settings.on ?? {};
    const direct: Partial<Record<string, ((event: never) => void) | undefined>> = {
      [PAGINATOR_EVENTS.BEFORE_CHANGE]: settings.onBeforeChange,
      [PAGINATOR_EVENTS.CHANGE]: settings.onChange,
    };
    const emit = <T>(name: string, payload: T): T => {
      component.emit(name, payload as unknown as Record<string, unknown>);
      (callbacks[name as keyof PaginatorEvents] as ((event: T) => void) | undefined)?.(payload);
      direct[name]?.(payload as never);
      return payload;
    };

    const getPageCount = (): number => Math.max(1, Math.ceil(state.total / state.pageSize));
    const getRange = (): PaginatorRange => {
      const start = state.total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
      const end = Math.min(state.page * state.pageSize, state.total);
      return { start, end, total: state.total, page: state.page, pageSize: state.pageSize };
    };

    const uid = nextId();
    const root = component.element;
    const pageSize = withPageSize(settings, component.getClass, uid, (chosen) => {
      if (state.disabled) return;
      const next = positive(chosen);
      if (!next || next === state.pageSize) {
        pageSize.sync(state.pageSize, pageSizes);
        return;
      }
      if (!propose(1, next)) pageSize.sync(state.pageSize, pageSizes);
    });
    const range = document.createElement("p");
    range.className = component.getClass(PAGINATOR_CLASSES.RANGE);
    range.setAttribute("aria-live", "polite");
    range.setAttribute("aria-atomic", "true");

    const navigation = withNavigation(
      settings, component.getClass, () => ({ page: state.page, pageCount: getPageCount() }), (target) => void goTo(target),
    );
    const numberedPages = withNumberedPages(settings, component.getClass, navigation.pages, (target) => void goTo(target));

    root.append(pageSize.element, range, navigation.element);

    const drawRange = (): void => {
      const current = getRange();
      range.textContent = settings.formatRange?.(current) ?? `${current.start}–${current.end} of ${current.total}`;
    };
    const refresh = (): void => {
      const pageCount = getPageCount();
      state.page = Math.min(Math.max(1, state.page), pageCount);
      pageSize.sync(state.pageSize, pageSizes);
      navigation.sync(state.page, pageCount, state.disabled, settings.ends !== false);
      numberedPages.render({ page: state.page, pageCount, disabled: state.disabled });
      root.classList.toggle(component.getClass(PAGINATOR_MODIFIERS.DISABLED), state.disabled);
      pageSize.select.disabled = state.disabled;
      drawRange();
      stateListeners.forEach((listener) => listener());
    };

    /**
     * The user path: the proposal is vetoable, and only then does the model
     * commit. Returns whether it committed.
     */
    const propose = (page: number, size: number): boolean => {
      if (state.disabled) return false;
      const pageCount = Math.max(1, Math.ceil(state.total / size));
      const target = Math.min(Math.max(1, Math.floor(page)), pageCount);
      if (target === state.page && size === state.pageSize) return false;
      let prevented = false;
      const payload: PaginatorBeforeChangeEvent = {
        page: target,
        pageSize: size,
        previousPage: state.page,
        previousPageSize: state.pageSize,
        preventDefault: () => {
          prevented = true;
        },
        get defaultPrevented() {
          return prevented;
        },
      };
      emit(PAGINATOR_EVENTS.BEFORE_CHANGE, payload);
      if (prevented) return false;
      const previousPage = state.page;
      const previousPageSize = state.pageSize;
      state.page = target;
      state.pageSize = size;
      refresh();
      const detail: PaginatorChangeEvent = { page: state.page, pageSize: state.pageSize, previousPage, previousPageSize };
      emit(PAGINATOR_EVENTS.CHANGE, detail);
      return true;
    };

    const goTo = (page: number): boolean => {
      const target = positive(page);
      if (!target || state.disabled || target > getPageCount()) return false;
      if (target === state.page) return false;
      return propose(target, state.pageSize);
    };

    const silent = (): void => {
      refresh();
    };

    refresh();

    const core: PaginatorCore = {
      settings,
      state,
      pageSize,
      navigation,
      numbered: numberedPages,
      select: pageSize.select,
      range,
      goTo,
      setPage: (page) => {
        const next = positive(page);
        if (!next) return;
        state.page = Math.min(next, getPageCount());
        silent();
      },
      setPageSize: (size) => {
        const next = positive(size);
        if (!next) return;
        state.pageSize = next;
        state.page = Math.min(state.page, getPageCount());
        silent();
      },
      setPageSizes: (sizes) => {
        pageSizes = sizes.filter((size) => positive(size) !== undefined).map((size) => positive(size)!);
        silent();
      },
      getPageSizes: () => [...pageSizes],
      setTotal: (total) => {
        const number = Number(total);
        state.total = Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
        state.page = Math.min(state.page, getPageCount());
        silent();
      },
      setNumbered: (next) => {
        settings.numbered = next;
        silent();
      },
      getPageCount,
      getRange,
      stateListeners,
      destroy: () => {
        pageSize.destroy();
        navigation.destroy();
        numberedPages.destroy();
        stateListeners.length = 0;
      },
    };

    return { ...component, paginator: core };
  };

export const createPaginator = (config: PaginatorConfig = {}): PaginatorComponent => {
  const settings = createBaseConfig(config);
  const built = pipe(
    createBase,
    withEvents(),
    withElement(getElementConfig(settings)),
    withDisabled(settings),
    withLifecycle(),
    withPaginationCore(settings),
  )(settings as never) as PaginatorHost & { paginator: PaginatorCore };
  return withAPI(getApiConfig(built))(built as unknown as Record<string, unknown>) as unknown as PaginatorComponent;
};

export default createPaginator;
