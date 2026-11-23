// src/components/data-grid/index.ts

/**
 * Data grid module: virtualized rows in columns, with column sort, row
 * selection and the grid keyboard. The list engine is `vlist` (a regular
 * dependency); material stays a peer for the checkbox and the tokens.
 *
 * @module components/data-grid
 */

export { default as createDataGrid } from "./data-grid";
export type {
  DataGridAlign,
  DataGridChange,
  DataGridColumn,
  DataGridComponent,
  DataGridConfig,
  DataGridDensity,
  DataGridFill,
  DataGridItem,
  DataGridMotion,
  DataGridSelection,
  DataGridSort,
  DataGridSortDirection,
  DataGridSortState,
} from "./types";
