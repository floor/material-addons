// src/components/breadcrumb/config.ts

import type { withElement } from "material/core/compose";
import { BREADCRUMB_CLASSES, BREADCRUMB_DEFAULTS } from "./constants";
import type { BreadcrumbConfig } from "./types";

export const defaultConfig: BreadcrumbConfig = {
  items: [],
  value: undefined,
  collapse: BREADCRUMB_DEFAULTS.COLLAPSE,
  disabled: BREADCRUMB_DEFAULTS.DISABLED,
  ariaLabel: BREADCRUMB_DEFAULTS.ARIA_LABEL,
  overflowLabel: BREADCRUMB_DEFAULTS.OVERFLOW_LABEL,
  separator: undefined,
  class: undefined,
  componentName: BREADCRUMB_DEFAULTS.COMPONENT_NAME,
};

export interface BreadcrumbSettings extends BreadcrumbConfig {
  collapse: boolean;
  disabled: boolean;
  ariaLabel: string;
  overflowLabel: string;
  componentName: string;
}

export const createBaseConfig = (config: BreadcrumbConfig = {}): BreadcrumbSettings =>
  ({ ...defaultConfig, ...config }) as BreadcrumbSettings;

export const getElementConfig = (settings: BreadcrumbSettings): Parameters<typeof withElement>[0] => {
  const prefix = "mtrl";
  const className = [`${prefix}-${BREADCRUMB_CLASSES.ROOT}`, settings.class].filter(
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
