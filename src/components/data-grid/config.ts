// src/components/data-grid/config.ts

import type { withElement } from "material/core/compose";
import { DATA_GRID_DEFAULTS, DATA_GRID_HEIGHTS } from "./constants";
import type { DataGridConfig, DataGridDensity } from "./types";

export const defaultConfig: DataGridConfig = {
  columns: [],
  items: [],
  selection: DATA_GRID_DEFAULTS.SELECTION,
  density: DATA_GRID_DEFAULTS.DENSITY,
  fill: DATA_GRID_DEFAULTS.FILL,
  columnBorders: DATA_GRID_DEFAULTS.COLUMN_BORDERS,
  rowBorders: DATA_GRID_DEFAULTS.ROW_BORDERS,
  motion: DATA_GRID_DEFAULTS.MOTION,
  busy: DATA_GRID_DEFAULTS.BUSY,
  disabled: DATA_GRID_DEFAULTS.DISABLED,
  ariaLabel: DATA_GRID_DEFAULTS.ARIA_LABEL,
  class: undefined,
};

export interface DataGridSettings extends DataGridConfig {
  selection: NonNullable<DataGridConfig["selection"]>;
  density: DataGridDensity;
  fill: NonNullable<DataGridConfig["fill"]>;
  motion: NonNullable<DataGridConfig["motion"]>;
  ariaLabel: string;
}

/** The caller's configuration with the defaults filled in */
export const createBaseConfig = (config: DataGridConfig): DataGridSettings =>
  ({ ...defaultConfig, ...config }) as DataGridSettings;

/** Header and row heights for a density step */
export const heightsFor = (density: DataGridDensity): { header: number; row: number } =>
  DATA_GRID_HEIGHTS[density] ?? DATA_GRID_HEIGHTS[0];

export const getElementConfig = (settings: DataGridSettings): Parameters<typeof withElement>[0] => {
  const prefix = DATA_GRID_DEFAULTS.PREFIX;
  const className = [`${prefix}-${DATA_GRID_DEFAULTS.COMPONENT_NAME}`, settings.class].filter(
    (name): name is string => Boolean(name),
  );
  return {
    tag: "div",
    componentName: DATA_GRID_DEFAULTS.COMPONENT_NAME,
    className,
    attributes: { "aria-label": settings.ariaLabel },
    interactive: true,
  };
};
