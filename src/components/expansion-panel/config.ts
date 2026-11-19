// src/components/expansion-panel/config.ts

import type { withElement } from "material/core/compose";
import {
  ACCORDION_CLASSES,
  EXPANSION_PANEL_CLASSES,
  EXPANSION_PANEL_DEFAULTS,
  EXPANSION_PANEL_DENSITIES,
  EXPANSION_PANEL_MODIFIERS,
  EXPANSION_PANEL_PLACEMENTS,
  EXPANSION_PANEL_VARIANTS,
} from "./constants";
import type { AccordionConfig, ExpansionPanelConfig } from "./types";

export const defaultConfig: ExpansionPanelConfig = {
  value: undefined,
  label: "",
  supportingText: undefined,
  content: undefined,
  actions: undefined,
  variant: EXPANSION_PANEL_DEFAULTS.VARIANT,
  density: EXPANSION_PANEL_DEFAULTS.DENSITY,
  placement: EXPANSION_PANEL_DEFAULTS.PLACEMENT,
  noToggle: false,
  leadingIcon: undefined,
  trailingIcon: undefined,
  open: false,
  error: false,
  disabled: false,
  divider: false,
  lazy: false,
  headingLevel: EXPANSION_PANEL_DEFAULTS.HEADING_LEVEL,
  ariaLabel: undefined,
  class: undefined,
  componentName: EXPANSION_PANEL_DEFAULTS.COMPONENT_NAME,
};

export interface ExpansionPanelSettings extends ExpansionPanelConfig {
  variant: (typeof EXPANSION_PANEL_VARIANTS)[keyof typeof EXPANSION_PANEL_VARIANTS];
  density: (typeof EXPANSION_PANEL_DENSITIES)[keyof typeof EXPANSION_PANEL_DENSITIES];
  placement: (typeof EXPANSION_PANEL_PLACEMENTS)[keyof typeof EXPANSION_PANEL_PLACEMENTS];
  headingLevel: NonNullable<ExpansionPanelConfig["headingLevel"]>;
  componentName: string;
}

/** The caller's configuration with the defaults filled in */
export const createBaseConfig = (config: ExpansionPanelConfig = {}): ExpansionPanelSettings => ({
  ...defaultConfig,
  ...config,
}) as ExpansionPanelSettings;

export const getElementConfig = (
  settings: ExpansionPanelSettings,
): Parameters<typeof withElement>[0] => {
  const prefix = EXPANSION_PANEL_DEFAULTS.PREFIX;
  const className = [`${prefix}-${EXPANSION_PANEL_CLASSES.ROOT}`, settings.class].filter((name): name is string => Boolean(name));

  return {
    tag: "div",
    componentName: settings.componentName,
    className,
    attributes: { "data-mtrl-expansion-panel": "" },
    interactive: true,
  };
};

export const defaultAccordionConfig: AccordionConfig = {
  panels: [],
  value: null,
  values: [],
  multiSelect: false,
  variant: EXPANSION_PANEL_DEFAULTS.VARIANT,
  density: EXPANSION_PANEL_DEFAULTS.DENSITY,
  placement: EXPANSION_PANEL_DEFAULTS.PLACEMENT,
  separated: false,
  disabled: false,
  class: undefined,
  componentName: EXPANSION_PANEL_DEFAULTS.ACCORDION_COMPONENT_NAME,
};

export interface AccordionSettings extends AccordionConfig {
  multiSelect: boolean;
  separated: boolean;
  disabled: boolean;
  componentName: string;
}

export const createAccordionBaseConfig = (config: AccordionConfig = {}): AccordionSettings => ({
  ...defaultAccordionConfig,
  ...config,
}) as AccordionSettings;

export const getAccordionElementConfig = (
  settings: AccordionSettings,
): Parameters<typeof withElement>[0] => {
  const prefix = EXPANSION_PANEL_DEFAULTS.PREFIX;
  const className = [
    `${prefix}-${ACCORDION_CLASSES.ROOT}`,
    settings.separated ? `${prefix}-${ACCORDION_CLASSES.SEPARATED}` : `${prefix}-${ACCORDION_CLASSES.FLAT}`,
    settings.multiSelect ? `${prefix}-${ACCORDION_CLASSES.MULTI}` : undefined,
    settings.class,
  ].filter((name): name is string => Boolean(name));

  return {
    tag: "div",
    componentName: settings.componentName,
    className,
    attributes: { role: "group" },
    interactive: true,
  };
};
