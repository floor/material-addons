// src/components/data-grid/types.ts

import type {
  DataGridSelectionName,
} from "./constants";

export type DataGridSelection = DataGridSelectionName;
export type DataGridDensity = 0 | -1 | -2 | -3;
export type DataGridAlign = "start" | "center" | "end";
export type DataGridFill = "spacer" | "stretch" | "none";
export type DataGridMotion = "pulse" | "wave";
export type DataGridSortDirection = "asc" | "desc" | null;

/** One row: an id and whatever the columns read from it. */
export interface DataGridItem {
  id: string;
  [key: string]: unknown;
}

/** One column. The selection column is added by the grid, not the caller. */
export interface DataGridColumn<T extends DataGridItem = DataGridItem> {
  key: string;
  label: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  sortable?: boolean;
  align?: DataGridAlign;
  /** Reading-order edge. Mapped onto vlist's physical sides until vlist takes logical ones. */
  pin?: "start" | "end";
  /** Replaces the default text cell. */
  cell?: (item: T, column: DataGridColumn<T>, rowIndex: number) => string | HTMLElement;
}

/** What a selection change carries. */
export interface DataGridChange {
  value: string | null;
  values: string[];
}

/** What a sort request carries. `preventDefault` keeps the previous order and indicator. */
export interface DataGridSort {
  key: string;
  direction: DataGridSortDirection;
  preventDefault: () => void;
  defaultPrevented: boolean;
}

export interface DataGridConfig<T extends DataGridItem = DataGridItem> {
  columns: DataGridColumn<T>[];
  items?: T[];
  selection?: DataGridSelection;
  value?: string | null;
  values?: string[];
  density?: DataGridDensity;
  fill?: DataGridFill;
  columnBorders?: boolean;
  rowBorders?: boolean;
  motion?: DataGridMotion;
  busy?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  class?: string;
  /** In-memory compare. The default compares `item[key]` as a string or a number. */
  sort?: (items: readonly T[], key: string, direction: DataGridSortDirection) => readonly T[];
  onChange?: (payload: DataGridChange) => void;
  onSort?: (payload: DataGridSort) => void;
}

/** Sort state, as `getSort` reports it. */
export interface DataGridSortState {
  key: string | null;
  direction: DataGridSortDirection;
}

export interface DataGridComponent<T extends DataGridItem = DataGridItem> {
  /** The `.mtrl-data-grid` root */
  element: HTMLElement;
  /** The vlist root, `role="grid"` */
  list: HTMLElement;
  getValue: () => string | null;
  setValue: (value: string | null) => void;
  getValues: () => string[];
  setValues: (values: string[]) => void;
  setColumns: (columns: DataGridColumn<T>[]) => void;
  resizeColumn: (key: string, width: number) => void;
  getColumnWidths: () => Record<string, number>;
  getSort: () => DataGridSortState;
  setSort: (key: string | null, direction?: DataGridSortDirection) => void;
  enable: () => void;
  disable: () => void;
  isDisabled: () => boolean;
  on: (event: string, listener: (payload: never) => void) => DataGridComponent<T>;
  off: (event: string, listener: (payload: never) => void) => DataGridComponent<T>;
  destroy: () => void;
}
