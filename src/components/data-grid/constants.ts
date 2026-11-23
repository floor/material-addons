// src/components/data-grid/constants.ts

/** Events the factory emits. `sort` is cancelable. */
export const DATA_GRID_EVENTS = {
  SORT: "sort",
  CHANGE: "change",
} as const;

/** Selection modes, as the `selection` config and attribute take them. */
export const DATA_GRID_SELECTIONS = ["none", "single", "multiple"] as const;
export type DataGridSelectionName = (typeof DATA_GRID_SELECTIONS)[number];

/** Density steps: the M3 scale read down from 0. */
export const DATA_GRID_DENSITIES = [0, -1, -2, -3] as const;

/** Header and row heights per density, in pixels. */
export const DATA_GRID_HEIGHTS: Record<number, { header: number; row: number }> = {
  0: { header: 56, row: 52 },
  [-1]: { header: 52, row: 48 },
  [-2]: { header: 48, row: 44 },
  [-3]: { header: 44, row: 40 },
};

/** Value alignments, in reading order. */
export const DATA_GRID_ALIGNS = ["start", "center", "end"] as const;

/** How leftover horizontal space is filled. */
export const DATA_GRID_FILLS = ["spacer", "stretch", "none"] as const;

/** Placeholder bar animations, as `createSkeleton` spells them. */
export const DATA_GRID_MOTIONS = ["pulse", "wave"] as const;

/** Sort directions. `null` restores the authored order. */
export const DATA_GRID_SORT_DIRECTIONS = ["asc", "desc", null] as const;

/** The key of the leading checkbox column. It is not a consumer column. */
export const DATA_GRID_SELECT_COLUMN = "select";

/** CSS classes. vlist's own nodes keep vlist's class names. */
export const DATA_GRID_CLASSES = {
  ROOT: "data-grid",
  LIST: "list",
  PAGINATOR: "paginator",
} as const;

export const DATA_GRID_DEFAULTS = {
  SELECTION: "none",
  DENSITY: 0,
  FILL: "spacer",
  COLUMN_BORDERS: false,
  ROW_BORDERS: true,
  PAGED: false,
  PAGE: 1,
  PAGE_SIZE: 25,
  PAGE_SIZES: [10, 25, 50, 100],
  MOTION: "wave",
  BUSY: true,
  DISABLED: false,
  ARIA_LABEL: "Data grid",
  SELECT_COLUMN_WIDTH: 48,
  COMPONENT_NAME: "data-grid",
  PREFIX: "mtrl",
} as const;
