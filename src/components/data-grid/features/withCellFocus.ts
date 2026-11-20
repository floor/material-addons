// src/components/data-grid/features/withCellFocus.ts

/**
 * The cell layer: one roving cell tab stop over vlist's rows, and the grid
 * keyboard's horizontal axis. vlist gives rows focus while its selection
 * model owns the vertical keys; this layer takes the whole body keyboard so
 * the active *cell* is the one focus model in every selection mode:
 *
 * - ArrowUp / ArrowDown move by row, ArrowLeft / ArrowRight by column in the
 *   reading order (mirrored under RTL), at vlist's fixed row height
 * - Home / End go to the row's ends, Ctrl+Home / Ctrl+End to the grid's corners
 * - PageUp / PageDown move a viewport of rows
 * - Enter / Space toggle the active row's selection when a selection model
 *   is mounted
 *
 * The active cell survives virtualization: its row and column are indices, and
 * every render or scroll puts the roving tabindex back on whichever cell holds
 * that position when it is on screen.
 */

import type { DataGridSelection } from "../types";

export interface CellFocusOptions {
  /** The `.mtrl-data-grid` root, a capture listener above vlist's own */
  root: HTMLElement;
  /** The content element vlist recycles rows into */
  content: () => HTMLElement | null;
  /** Rendered rows, in data order */
  rowCount: () => number;
  /** Columns, the selection column included */
  columnCount: () => number;
  /** Scroll a data index into view */
  scrollToIndex: (index: number) => void;
  /** The row's id, for the selection toggle */
  rowIdAt: (index: number) => string | undefined;
  selection: DataGridSelection;
  toggleRow: (id: string) => void;
  /** Whether the reading direction is RTL where the grid sits */
  isRtl: () => boolean;
}

export interface CellFocusFeature {
  /** The active position, in data indices */
  position: () => { row: number; column: number };
  /** Put the roving tabindex on the active cell and focus it */
  focus: () => void;
  /** Re-apply after a render, keeping the active cell's tabindex */
  sync: () => void;
  destroy: () => void;
}

const CELL = ".vlist-table-cell";
const PAGE_ROWS = 10;

export const withCellFocus = (options: CellFocusOptions): CellFocusFeature => {
  let row = 0;
  let column = 0;
  let destroyed = false;
  let pendingFocus = false;
  let scheduled = false;

  const clampRow = (value: number): number => Math.min(Math.max(0, value), Math.max(0, options.rowCount() - 1));
  const clampColumn = (value: number): number => Math.min(Math.max(0, value), Math.max(0, options.columnCount() - 1));

  const rowElement = (index: number): HTMLElement | null => {
    const content = options.content();
    if (!content) return null;
    return content.querySelector<HTMLElement>(`.vlist-table-row[data-index="${index}"]`);
  };
  const cellsOf = (element: HTMLElement): HTMLElement[] => Array.from(element.querySelectorAll<HTMLElement>(CELL));

  const apply = (): void => {
    scheduled = false;
    if (destroyed) return;
    const content = options.content();
    if (!content) return;
    for (const cell of Array.from(content.querySelectorAll<HTMLElement>(CELL))) cell.tabIndex = -1;
    const element = rowElement(row);
    if (!element) {
      pendingFocus = false;
      return;
    }
    const target = cellsOf(element)[column];
    if (!target) return;
    target.tabIndex = 0;
    if (pendingFocus) {
      pendingFocus = false;
      target.focus({ preventScroll: true });
    }
  };

  const schedule = (): void => {
    if (scheduled || destroyed) return;
    scheduled = true;
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(apply);
    else setTimeout(apply, 0);
  };

  const move = (nextRow: number, nextColumn: number, focus = true): void => {
    row = clampRow(nextRow);
    column = clampColumn(nextColumn);
    pendingFocus = focus;
    options.scrollToIndex(row);
    schedule();
    // A render after a scroll can land a frame later
    setTimeout(() => {
      if (!destroyed && pendingFocus) apply();
    }, 16);
  };

  const stepColumn = (delta: number): number => {
    const direction = options.isRtl() ? -1 : 1;
    return column + delta * direction;
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (destroyed) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(".vlist-table-header, .vlist-table-header-cell")) return;
    const inBody = Boolean(target?.closest(CELL)) || Boolean(target?.closest(".vlist") && !target.closest(".vlist-table-header"));
    if (!inBody) return;
    const lastRow = Math.max(0, options.rowCount() - 1);
    const lastColumn = Math.max(0, options.columnCount() - 1);
    switch (event.key) {
      case "ArrowRight":
      case "ArrowLeft": {
        event.preventDefault();
        event.stopPropagation();
        move(row, stepColumn(event.key === "ArrowRight" ? 1 : -1));
        return;
      }
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        event.stopPropagation();
        move(row + (event.key === "ArrowDown" ? 1 : -1), column);
        return;
      }
      case "Home": {
        event.preventDefault();
        event.stopPropagation();
        if (event.ctrlKey || event.metaKey) move(0, 0);
        else move(row, 0);
        return;
      }
      case "End": {
        event.preventDefault();
        event.stopPropagation();
        if (event.ctrlKey || event.metaKey) move(lastRow, lastColumn);
        else move(row, lastColumn);
        return;
      }
      case "PageDown":
      case "PageUp": {
        event.preventDefault();
        event.stopPropagation();
        move(row + (event.key === "PageDown" ? PAGE_ROWS : -PAGE_ROWS), column);
        return;
      }
      case "Enter":
      case " ": {
        if (options.selection === "none") return;
        event.preventDefault();
        event.stopPropagation();
        const id = options.rowIdAt(row);
        if (id !== undefined) options.toggleRow(id);
        return;
      }
      default:
        return;
    }
  };

  const onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    const cell = target?.closest<HTMLElement>(CELL);
    const element = cell?.closest<HTMLElement>(".vlist-table-row");
    if (!cell || !element) return;
    row = clampRow(Number(element.getAttribute("data-index") ?? 0));
    column = clampColumn(cellsOf(element).indexOf(cell));
    pendingFocus = false;
    schedule();
  };

  const onFocusIn = (event: FocusEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".vlist-table-header")) return;
    if (target?.closest(CELL)) return;
    if (!target?.closest(".vlist")) return;
    // Focus landed on the grid root (a display-only grid has no vlist tab
    // stop): bring the active cell back and hand it the tab stop
    pendingFocus = true;
    options.scrollToIndex(row);
    schedule();
  };

  options.root.addEventListener("keydown", onKeydown, true);
  options.root.addEventListener("click", onClick, true);
  options.root.addEventListener("focusin", onFocusIn, true);
  schedule();

  return {
    position: () => ({ row, column }),
    focus: () => move(row, column),
    sync: schedule,
    destroy: () => {
      destroyed = true;
      options.root.removeEventListener("keydown", onKeydown, true);
      options.root.removeEventListener("click", onClick, true);
      options.root.removeEventListener("focusin", onFocusIn, true);
    },
  };
};
