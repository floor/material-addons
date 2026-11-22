// src/components/tree/constants.ts

export const TREE_SELECTIONS = ["none", "single", "multiple"] as const;
export const TREE_PLACEMENTS = ["start", "end"] as const;

/** Lower-case event names; the vetoable three bridge cancelable by hand. */
export const TREE_EVENTS = {
  BEFORE_EXPAND: "beforeexpand",
  EXPAND: "expand",
  BEFORE_COLLAPSE: "beforecollapse",
  COLLAPSE: "collapse",
  BEFORE_CHANGE: "beforechange",
  CHANGE: "change",
  ACTIVATE: "activate",
  LOAD: "load",
  ERROR: "error",
} as const;

export const TREE_CLASSES = {
  ROOT: "mtrl-tree",
  ITEM: "mtrl-tree__item",
  ROW: "mtrl-tree__row",
  TOGGLE: "mtrl-tree__toggle",
  LEADING_ICON: "mtrl-tree__leading-icon",
  LABEL: "mtrl-tree__label",
  SUPPORTING_TEXT: "mtrl-tree__supporting-text",
  CHECK: "mtrl-tree__check",
  GROUP: "mtrl-tree__group",
} as const;

export const TREE_DEFAULTS = {
  SELECTION: "none",
  PLACEMENT: "start",
  INDENT: 24,
  TYPE_AHEAD: true,
  TYPE_AHEAD_BUFFER_MS: 500,
  EXPAND_DURATION_MS: 150,
} as const;
