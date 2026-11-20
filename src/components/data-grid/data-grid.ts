// src/components/data-grid/data-grid.ts

/**
 * The data grid: a Material layer over vlist's table(). vlist virtualizes the
 * rows, writes the grid roles, the sticky header, the roving header tabindex
 * and the body keyboard; the layer adds the M3 density heights, the selection
 * column and its checkboxes, the in-memory sort, and the factory events.
 *
 * The layer never calls `sortable()`, `page()`, `a11y()` or `autosize()`, and
 * keeps `multiSort` off. `table()` sorts nothing: it emits `column:sort` and
 * the layer reorders the items and sets the indicator.
 */

import { createVList, table } from "vlist";
import type { TableColumn, VList } from "vlist";
import { createBase, pipe, withDisabled, withElement, withEvents, withLifecycle } from "material/core/compose";
import { DATA_GRID_EVENTS, DATA_GRID_SELECTIONS } from "./constants";
import type { DataGridSettings } from "./config";
import { createBaseConfig, getElementConfig, heightsFor } from "./config";
import { createSelectionColumn, toTableColumn } from "./columns";
import { withCellFocus } from "./features/withCellFocus";
import type {
  DataGridComponent,
  DataGridConfig,
  DataGridItem,
  DataGridSort,
  DataGridSortDirection,
  DataGridSortState,
} from "./types";

export type { DataGridComponent };

interface DataGridHost {
  element: HTMLElement;
  getClass: (name: string) => string;
  emit: (event: string, data?: unknown) => void;
  disabled: { enable: () => void; disable: () => void; isDisabled: () => boolean };
}

/** The default compare: numbers numerically, everything else as strings, then the id */
const compareValues = (a: unknown, b: unknown): number => {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const left = a === undefined || a === null ? "" : String(a);
  const right = b === undefined || b === null ? "" : String(b);
  return left.localeCompare(right);
};

const defaultSort = <T extends DataGridItem>(
  items: readonly T[],
  key: string,
  direction: DataGridSortDirection,
): readonly T[] => {
  if (direction === null) return items;
  const factor = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => factor * (compareValues(a[key], b[key]) || compareValues(a.id, b.id)));
};

const withDataGridCore =
  (settings: DataGridSettings) =>
  (component: DataGridHost): DataGridHost & { grid: DataGridComponent } => {
    const state = {
      selection: DATA_GRID_SELECTIONS.includes(settings.selection) ? settings.selection : "none",
      disabled: settings.disabled === true || component.disabled.isDisabled(),
      sort: { key: null, direction: null } as DataGridSortState,
    };
    let destroyed = false;
    let authored: readonly DataGridItem[] = settings.items ?? [];
    let rendered: readonly DataGridItem[] = authored;
    const selected = new Set<string>(settings.values ?? (settings.value != null ? [String(settings.value)] : []));

    // The list fills the root; the caller gives the root its height
    const listEl = document.createElement("div");
    listEl.className = component.getClass("list");
    listEl.style.height = "100%";
    component.element.append(listEl);

    const heights = heightsFor(settings.density);

    const selectionColumn = state.selection === "none" ? null : createSelectionColumn({
      multiple: state.selection === "multiple",
      isSelected: (id) => selected.has(id),
      allSelected: () => ({
        all: rendered.length > 0 && rendered.every((item) => selected.has(String(item.id))),
        some: rendered.some((item) => selected.has(String(item.id))),
      }),
      onToggleRow: (id) => toggleRow(id),
      onToggleAll: () => toggleAll(),
      disabled: () => state.disabled,
    });

    const dataColumns = (columns: DataGridConfig["columns"]): TableColumn<DataGridItem>[] =>
      columns.map((column) => toTableColumn(column as never) as TableColumn<DataGridItem>);

    const tableConfig = {
        columns: [...(selectionColumn ? [selectionColumn as never] : []), ...dataColumns(settings.columns)],
        rowHeight: heights.row,
        headerHeight: heights.header,
        resizable: true,
        fillWidth: settings.fill === "stretch" ? "stretch" : settings.fill === "none" ? false : "spacer",
        columnBorders: settings.columnBorders === true,
        rowBorders: settings.rowBorders !== false,
    };
    // No vlist `selection()`: it keeps its focused row in view on every
    // scroll, which snaps a wheel back to that row, and it owns aria-selected
    // so the layer could not paint it. The layer keeps the selection state and
    // paints the rows itself, so one focus model (the active cell) remains.
    const plugins = [table(tableConfig as never)];

    const list = createVList(
      {
        container: listEl,
        items: [...rendered] as DataGridItem[],
        item: { height: heights.row, template: (item: DataGridItem) => String(item.id) },
        ariaLabel: settings.ariaLabel,
      },
      plugins as never,
    ) as VList<DataGridItem> & {
      setSort: (key: string | null, direction?: DataGridSortDirection) => void;
      resizeColumn: (key: string, width: number) => void;
      getColumnWidths: () => Record<string, number>;
      updateColumns: (columns: TableColumn<DataGridItem>[]) => void;
      select?: (...ids: string[]) => void;
      deselect?: (...ids: string[]) => void;
      toggleSelect?: (id: string) => void;
      selectAll?: () => void;
      clearSelection?: () => void;
    };

    const callbacks = {
      change: settings.onChange,
      sort: settings.onSort,
    };
    const emit = <T>(name: string, payload: T): T => {
      component.emit(name, payload as unknown as Record<string, unknown>);
      (callbacks[name as keyof typeof callbacks] as ((event: T) => void) | undefined)?.(payload);
      return payload;
    };

    const syncCheckboxes = (): void => {
      if (!selectionColumn) return;
      const header = listEl.querySelector(".vlist-table-header [role='columnheader'] m-checkbox");
      if (header) {
        const state2 = { all: rendered.length > 0 && rendered.every((item) => selected.has(String(item.id))),
          some: rendered.some((item) => selected.has(String(item.id))) };
        setCheckbox(header, state2.all, !state2.all && state2.some);
      }
      for (const row of Array.from(listEl.querySelectorAll(".vlist-table-row"))) {
        const id = row.getAttribute("data-id") ?? "";
        const box = row.querySelector("m-checkbox");
        if (box) setCheckbox(box, selected.has(id), false);
      }
    };

    const setCheckbox = (element: Element, checked: boolean, indeterminate: boolean): void => {
      const checkbox = element as Element & { setChecked?: (value: boolean) => void; setIndeterminate?: (value: boolean) => void };
      element.toggleAttribute("checked", checked);
      element.toggleAttribute("indeterminate", indeterminate);
      checkbox.setChecked?.(checked);
      checkbox.setIndeterminate?.(indeterminate);
    };

    // Paint the selection onto the rendered rows; vlist recycles them, so it
    // runs on every render and scroll
    const paintSelection = (): void => {
      if (!selectionColumn) return;
      for (const row of Array.from(listEl.querySelectorAll<HTMLElement>(".vlist-table-row"))) {
        const id = row.getAttribute("data-id") ?? "";
        const isSelected = selected.has(id);
        row.setAttribute("aria-selected", isSelected ? "true" : "false");
        row.classList.toggle("vlist-item--selected", isSelected);
      }
    };

    const emitChange = (): void => {
      const values = [...selected];
      emit(DATA_GRID_EVENTS.CHANGE, { value: values.length ? values[values.length - 1] : null, values });
      paintSelection();
      syncCheckboxes();
    };

    const toggleRow = (id: string): void => {
      if (state.disabled || !selectionColumn) return;
      if (state.selection === "single") {
        selected.clear();
        selected.add(id);
      } else if (selected.has(id)) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
      emitChange();
    };

    const toggleAll = (): void => {
      if (state.disabled || state.selection !== "multiple") return;
      const every = rendered.every((item) => selected.has(String(item.id)));
      if (every) {
        selected.clear();
      } else {
        rendered.forEach((item) => selected.add(String(item.id)));
      }
      emitChange();
    };

    // The body holds one tab stop, the active cell, in every selection mode;
    // the root's own tab stop is removed so the two never both sit in the
    // tab order
    const listRoot = list.element as HTMLElement;
    // vlist sets the root's tab stop while it registers the focus owner; the
    // active cell is the body's tab stop instead
    const stripRootTabStop = (): void => {
      if (listRoot.hasAttribute("tabindex")) listRoot.removeAttribute("tabindex");
    };
    stripRootTabStop();
    const tabStopWatcher = new MutationObserver(stripRootTabStop);
    tabStopWatcher.observe(listRoot, { attributes: true, attributeFilter: ["tabindex"] });
    const cellFocus = withCellFocus({
      root: component.element,
      content: () => listEl.querySelector(".vlist-content"),
      rowCount: () => rendered.length,
      columnCount: () => (selectionColumn ? 1 : 0) + settings.columns.length,
      scrollToIndex: (index) => list.scrollToIndex(index),
      rowIdAt: (index) => (rendered[index] ? String(rendered[index].id) : undefined),
      selection: state.selection,
      toggleRow,
      isRtl: () => {
        const scope = component.element.closest("[dir]");
        const value = scope?.getAttribute("dir") ?? document.documentElement.getAttribute("dir");
        return value === "rtl";
      },
    });
    // A click selects the row, as vlist's selection did; the checkbox cell
    // has its own change handler
    const onRowClick = (event: MouseEvent): void => {
      if (state.disabled || !selectionColumn) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("m-checkbox")) return;
      const row = target?.closest<HTMLElement>(".vlist-table-row");
      const id = row?.getAttribute("data-id");
      if (id) toggleRow(id);
    };
    listEl.addEventListener("click", onRowClick);

    const onRender = (): void => {
      paintSelection();
      cellFocus.sync();
    };
    list.on("range:change", onRender as never);
    list.on("scroll", onRender as never);

    const sortItems = (key: string | null, direction: DataGridSortDirection): void => {
      const cleared = key === null || direction === null;
      state.sort = cleared ? { key: null, direction: null } : { key, direction };
      rendered = cleared ? authored : (settings.sort ?? defaultSort)(authored, key, direction);
      list.setItems([...rendered]);
      cellFocus.sync();
      if (cleared) list.setSort(null);
      else list.setSort(key, direction ?? undefined);
      syncCheckboxes();
    };

    const onColumnSort = (event: { key: string; direction: DataGridSortDirection }): void => {
      if (destroyed || state.disabled) {
        list.setSort(state.sort.key, state.sort.direction ?? undefined);
        return;
      }
      let prevented = false;
      const payload: DataGridSort = {
        key: event.key,
        direction: event.direction,
        preventDefault: () => {
          prevented = true;
        },
        get defaultPrevented() {
          return prevented;
        },
      };
      emit(DATA_GRID_EVENTS.SORT, payload);
      if (prevented) {
        list.setSort(state.sort.key, state.sort.direction ?? undefined);
        return;
      }
      sortItems(event.key, event.direction);
    };

    list.on("column:sort", onColumnSort as never);

    const syncDisabled = (): void => {
      if (state.disabled) listEl.setAttribute("aria-disabled", "true");
      else listEl.removeAttribute("aria-disabled");
    };
    syncDisabled();

    const grid: DataGridComponent = {
      element: component.element,
      list: list.element as HTMLElement,
      getValue: () => (selected.size ? [...selected][selected.size - 1] : null),
      setValue: (value) => grid.setValues(value === null ? [] : [String(value)]),
      getValues: () => [...selected],
      setValues: (values) => {
        selected.clear();
          if (state.selection === "single") {
            if (values.length) selected.add(String(values[values.length - 1]));
          } else if (state.selection === "multiple") {
            values.forEach((id) => selected.add(String(id)));
          }
        paintSelection();
        syncCheckboxes();
      },
      setColumns: (columns) => {
        settings.columns = columns;
        list.updateColumns(columns.map((column) => toTableColumn(column as never) as TableColumn<DataGridItem>));
        if (selectionColumn) list.updateColumns?.([selectionColumn as never, ...columns.map((column) => toTableColumn(column as never))]);
      },
      resizeColumn: (key, width) => {
        if (key === (selectionColumn?.key ?? "")) return;
        list.resizeColumn(key, width);
      },
      getColumnWidths: () => list.getColumnWidths(),
      getSort: () => ({ ...state.sort }),
      setSort: (key, direction = "asc") => {
        if (key === null) sortItems(null, null);
        else sortItems(key, direction);
      },
      enable: () => {
        state.disabled = false;
        syncDisabled();
      },
      disable: () => {
        state.disabled = true;
        syncDisabled();
      },
      isDisabled: () => state.disabled,
      on: (event, listener) => {
        list.on(event as never, listener as never);
        return grid;
      },
      off: (event, listener) => {
        list.off(event as never, listener as never);
        return grid;
      },
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        tabStopWatcher.disconnect();
        listEl.removeEventListener("click", onRowClick);
        cellFocus.destroy();
        list.destroy();
        component.element.replaceChildren();
      },
    };

    return { ...component, grid };
  };

interface DataGridApi {
  element: HTMLElement;
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  off: (event: string, handler: (...args: unknown[]) => void) => unknown;
  lifecycle: { destroy: () => void };
  grid: DataGridComponent;
}

const withAPI = (component: DataGridApi): DataGridComponent => {
  const { grid, element, on, off, lifecycle } = component;
  const self = (): DataGridComponent => api;
  const api: DataGridComponent = {
    element,
    list: grid.list,
    getValue: grid.getValue,
    setValue: (value) => {
      grid.setValue(value);
      return self();
    },
    getValues: grid.getValues,
    setValues: (values) => {
      grid.setValues(values);
      return self();
    },
    setColumns: (columns) => {
      grid.setColumns(columns);
      return self();
    },
    resizeColumn: (key, width) => {
      grid.resizeColumn(key, width);
      return self();
    },
    getColumnWidths: grid.getColumnWidths,
    getSort: grid.getSort,
    setSort: (key, direction) => {
      grid.setSort(key, direction);
      return self();
    },
    enable: () => {
      grid.enable();
      return self();
    },
    disable: () => {
      grid.disable();
      return self();
    },
    isDisabled: grid.isDisabled,
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
      grid.destroy();
    },
  };
  return Object.assign(component, api) as unknown as DataGridComponent;
};

/** Creates a data grid */
const createDataGrid = (config: DataGridConfig): DataGridComponent => {
  const settings = createBaseConfig(config);
  const built = pipe(
    createBase,
    withEvents(),
    withElement(getElementConfig(settings)),
    withDisabled({ disabled: settings.disabled }),
    withLifecycle(),
    withDataGridCore(settings),
  )(settings as never) as unknown as DataGridApi;
  return withAPI(built);
};

export default createDataGrid;
