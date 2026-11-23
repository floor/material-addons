// src/components/data-grid/columns.ts

/**
 * Column mapping: the caller's columns onto vlist's `TableColumn`, plus the
 * leading checkbox column the grid owns. The selection column is keyed
 * `select`, is not sortable or resizable, and its cells are material
 * checkboxes, which vlist treats as the control's own activation.
 */

import type { TableColumn } from "vlist";
import { DATA_GRID_DEFAULTS, DATA_GRID_SELECT_COLUMN } from "./constants";
import type { DataGridColumn, DataGridItem } from "./types";

const aligns = { start: "left", center: "center", end: "right" } as const;

/**
 * A reading-order alignment as vlist's: vlist mirrors the row in RTL, so its
 * `left` lands on the reading start and its `right` on the reading end in
 * either direction. The measured check holds both directions to that.
 */
export const alignFor = (align: NonNullable<DataGridColumn["align"]>): "left" | "center" | "right" => aligns[align];

/** One caller column as vlist takes it. */
export const toTableColumn = <T extends DataGridItem>(column: DataGridColumn<T>): TableColumn<T> => ({
  key: column.key,
  label: column.label,
  ...(column.width === undefined ? {} : { width: column.width }),
  ...(column.minWidth === undefined ? {} : { minWidth: column.minWidth }),
  ...(column.maxWidth === undefined ? {} : { maxWidth: column.maxWidth }),
  ...(column.resizable === undefined ? {} : { resizable: column.resizable }),
  ...(column.sortable === undefined ? {} : { sortable: column.sortable }),
  ...(column.align === undefined ? {} : { align: alignFor(column.align) }),
  ...(column.cell === undefined
    ? {}
    : { cell: (item: T, tableColumn: TableColumn<T>, rowIndex: number) => column.cell?.(item, column, rowIndex) ?? "" }),
});

export interface SelectionColumnOptions {
  /** Multiple mode adds the header checkbox and its indeterminate state */
  multiple: boolean;
  /** Whether a row id is selected */
  isSelected: (id: string) => boolean;
  /** Every rendered row's id, in render order */
  allSelected: () => { all: boolean; some: boolean };
  /** A row checkbox was activated */
  onToggleRow: (id: string) => void;
  /** The header checkbox was activated */
  onToggleAll: () => void;
  disabled: () => boolean;
}

/**
 * The leading checkbox column. Its header control carries `tabindex="-1"`, so
 * vlist reads the activation as the control's own and the column never sorts.
 */
export const createSelectionColumn = <T extends DataGridItem>(
  options: SelectionColumnOptions,
): TableColumn<T> => {
  const checkbox = (checked: boolean, indeterminate: boolean, ariaLabel: string, activate: () => void): HTMLElement => {
    const element = document.createElement("m-checkbox");
    element.setAttribute("tabindex", "-1");
    if (checked) element.setAttribute("checked", "");
    if (indeterminate) element.setAttribute("indeterminate", "");
    element.setAttribute("aria-label", ariaLabel);
    if (options.disabled()) element.setAttribute("disabled", "");
    element.addEventListener("change", () => {
      if (options.disabled()) return;
      activate();
    });
    return element;
  };

  return {
    key: DATA_GRID_SELECT_COLUMN,
    label: "",
    width: DATA_GRID_DEFAULTS.SELECT_COLUMN_WIDTH,
    minWidth: DATA_GRID_DEFAULTS.SELECT_COLUMN_WIDTH,
    resizable: false,
    sortable: false,
    header: () => {
      if (!options.multiple) return "";
      const state = options.allSelected();
      return checkbox(state.all, !state.all && state.some, "Select all rows", () => options.onToggleAll());
    },
    cell: (item) => checkbox(options.isSelected(String(item.id)), false, "Select row", () => options.onToggleRow(String(item.id))),
  };
};
