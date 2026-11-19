// src/components/expansion-panel/index.ts

/**
 * Expansion panel module: a single disclosure panel and an accordion group.
 *
 * The barrel exports the factories and their public types; the constants live
 * on `material-addons/components/expansion-panel/constants`.
 *
 * @module components/expansion-panel
 */

export { default as createExpansionPanel } from "./expansion-panel";
export type {
  ExpansionPanelDensity,
  ExpansionPanelPlacement,
  ExpansionPanelVariant,
} from "./constants";
export { default as createAccordion } from "./accordion";

export type {
  AccordionChangeEvent,
  AccordionComponent,
  AccordionConfig,
  AccordionEvents,
  ExpansionPanelActions,
  ExpansionPanelBeforeEvent,
  ExpansionPanelComponent,
  ExpansionPanelConfig,
  ExpansionPanelContent,
  ExpansionPanelEvent,
  ExpansionPanelEvents,
  ExpansionPanelParts,
  HeadingLevel,
} from "./types";
