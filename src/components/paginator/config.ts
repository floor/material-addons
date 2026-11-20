// src/components/paginator/config.ts

import type { withElement } from "material/core/compose";
import { PAGINATOR_CLASSES, PAGINATOR_DEFAULTS } from "./constants";
import type { PaginatorConfig } from "./types";

export const defaultConfig: PaginatorConfig = {
  page: PAGINATOR_DEFAULTS.PAGE,
  pageSize: PAGINATOR_DEFAULTS.PAGE_SIZE,
  pageSizes: [...PAGINATOR_DEFAULTS.PAGE_SIZES],
  total: PAGINATOR_DEFAULTS.TOTAL,
  numbered: PAGINATOR_DEFAULTS.NUMBERED,
  siblingCount: PAGINATOR_DEFAULTS.SIBLING_COUNT,
  boundaryCount: PAGINATOR_DEFAULTS.BOUNDARY_COUNT,
  ends: PAGINATOR_DEFAULTS.ENDS,
  disabled: PAGINATOR_DEFAULTS.DISABLED,
  ariaLabel: PAGINATOR_DEFAULTS.ARIA_LABEL,
  pageSizeLabel: PAGINATOR_DEFAULTS.PAGE_SIZE_LABEL,
  firstLabel: PAGINATOR_DEFAULTS.FIRST_LABEL,
  prevLabel: PAGINATOR_DEFAULTS.PREV_LABEL,
  nextLabel: PAGINATOR_DEFAULTS.NEXT_LABEL,
  lastLabel: PAGINATOR_DEFAULTS.LAST_LABEL,
  class: undefined,
  componentName: PAGINATOR_DEFAULTS.COMPONENT_NAME,
};

export interface PaginatorSettings extends PaginatorConfig {
  pageSize: number;
  pageSizes: number[];
  total: number;
  numbered: boolean;
  siblingCount: number;
  boundaryCount: number;
  ends: boolean;
  ariaLabel: string;
  pageSizeLabel: string;
  firstLabel: string;
  prevLabel: string;
  nextLabel: string;
  lastLabel: string;
  componentName: string;
}

/** The caller's configuration with the defaults filled in */
export const createBaseConfig = (config: PaginatorConfig = {}): PaginatorSettings =>
  ({ ...defaultConfig, ...config }) as PaginatorSettings;

export const getElementConfig = (settings: PaginatorSettings): Parameters<typeof withElement>[0] => {
  const prefix = PAGINATOR_DEFAULTS.PREFIX;
  const className = [`${prefix}-${PAGINATOR_CLASSES.ROOT}`, settings.class].filter(
    (name): name is string => Boolean(name),
  );
  return {
    tag: "nav",
    componentName: settings.componentName,
    className,
    attributes: { "aria-label": settings.ariaLabel },
    interactive: true,
  };
};
