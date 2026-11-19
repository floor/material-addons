// src/components/expansion-panel/constants.ts

/** Surface treatments, as the card's variants */
export const EXPANSION_PANEL_VARIANTS = {
  OUTLINED: "outlined",
  ELEVATED: "elevated",
  FILLED: "filled",
} as const;

export const EXPANSION_PANEL_DENSITIES = {
  DEFAULT: "default",
  COMPACT: "compact",
} as const;

/** Logical inline side the chevron sits on */
export const EXPANSION_PANEL_PLACEMENTS = {
  END: "end",
  START: "start",
} as const;

export const EXPANSION_PANEL_EVENTS = {
  BEFORE_OPEN: "beforeopen",
  OPEN: "open",
  AFTER_OPEN: "afteropen",
  BEFORE_CLOSE: "beforeclose",
  CLOSE: "close",
  AFTER_CLOSE: "afterclose",
  CHANGE: "change",
} as const;

export const ACCORDION_EVENTS = {
  CHANGE: "change",
} as const;

/** BEM names without the prefix */
export const EXPANSION_PANEL_CLASSES = {
  ROOT: "expansion-panel",
  HEADING: "expansion-panel__heading",
  HEADER: "expansion-panel__header",
  RIPPLE: "expansion-panel__ripple",
  TOGGLE: "expansion-panel__toggle",
  LEADING_ICON: "expansion-panel__leading-icon",
  HEADER_CONTENT: "expansion-panel__header-content",
  LABEL: "expansion-panel__label",
  SUPPORTING_TEXT: "expansion-panel__supporting-text",
  REGION: "expansion-panel__region",
  REGION_INNER: "expansion-panel__region-inner",
  DIVIDER: "expansion-panel__divider",
  BODY: "expansion-panel__body",
  ACTIONS: "expansion-panel__actions",
} as const;

export const ACCORDION_CLASSES = {
  ROOT: "accordion",
  FLAT: "accordion--flat",
  SEPARATED: "accordion--separated",
  MULTI: "accordion--multi",
} as const;

export const EXPANSION_PANEL_MODIFIERS = {
  OPEN: "expansion-panel--open",
  ERROR: "expansion-panel--error",
  DISABLED: "expansion-panel--disabled",
  PLACEMENT_START: "expansion-panel--placement-start",
  OUTLINED: "expansion-panel--outlined",
  ELEVATED: "expansion-panel--elevated",
  FILLED: "expansion-panel--filled",
  COMPACT: "expansion-panel--compact",
} as const;

/** The chevron, inline so the component needs no asset request */
export const EXPANSION_PANEL_TOGGLE_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 15.4 5.6 9l1.4-1.4 5 5 5-5L18.4 9z"/></svg>';

export const EXPANSION_PANEL_DEFAULTS = {
  VARIANT: EXPANSION_PANEL_VARIANTS.OUTLINED,
  DENSITY: EXPANSION_PANEL_DENSITIES.DEFAULT,
  PLACEMENT: EXPANSION_PANEL_PLACEMENTS.END,
  HEADING_LEVEL: 3,
  COMPONENT_NAME: "expansion-panel",
  ACCORDION_COMPONENT_NAME: "accordion",
  PREFIX: "mtrl",
} as const;

export type ExpansionPanelVariant = (typeof EXPANSION_PANEL_VARIANTS)[keyof typeof EXPANSION_PANEL_VARIANTS];
export type ExpansionPanelDensity = (typeof EXPANSION_PANEL_DENSITIES)[keyof typeof EXPANSION_PANEL_DENSITIES];
export type ExpansionPanelPlacement = (typeof EXPANSION_PANEL_PLACEMENTS)[keyof typeof EXPANSION_PANEL_PLACEMENTS];
