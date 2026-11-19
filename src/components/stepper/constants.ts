// src/components/stepper/constants.ts

/**
 * Stepper component constants
 * @module components/stepper
 */

/** Stepper events */
export const STEPPER_EVENTS = {
  /** Fired before a step change; a listener may cancel it */
  BEFORE_CHANGE: "beforechange",
  /** Fired when the active step changed */
  CHANGE: "change",
  /** Fired when the last step completes */
  COMPLETE: "complete",
  /** Fired when validation fails for a step */
  ERROR: "error",
  /** Fired after reset() */
  RESET: "reset",
  /** Fired when orientation: "auto" resolves to the other axis */
  ORIENTATION_CHANGE: "orientationchange",
} as const;

/** Orientation options: the layout axis, or "auto" to follow the container width */
export const STEPPER_ORIENTATIONS = {
  HORIZONTAL: "horizontal",
  VERTICAL: "vertical",
  AUTO: "auto",
} as const;

/** Where the label sits relative to the indicator (horizontal layout) */
export const STEPPER_LABEL_PLACEMENTS = {
  /** Inline-end of the indicator */
  END: "end",
  /** Centred under the indicator */
  BOTTOM: "bottom",
} as const;

/** Where the header list sits relative to the panels (horizontal layout) */
export const STEPPER_HEADER_PLACEMENTS = {
  TOP: "top",
  BOTTOM: "bottom",
} as const;

/** Declarative action attributes handled by one delegated listener on the root */
export const STEPPER_ACTIONS = {
  NEXT: "data-stepper-next",
  PREV: "data-stepper-prev",
  RESET: "data-stepper-reset",
  GOTO: "data-stepper-goto",
} as const;

/** Class names, without the prefix */
export const STEPPER_CLASSES = {
  ROOT: "stepper",
  LIVE: "stepper__live",
  LIST: "stepper__list",
  ITEM: "stepper__item",
  HEADER: "stepper__header",
  RIPPLE: "stepper__ripple",
  INDICATOR: "stepper__indicator",
  LABEL_GROUP: "stepper__label-group",
  LABEL: "stepper__label",
  SUPPORTING_TEXT: "stepper__supporting-text",
  SR_STATUS: "stepper__sr-status",
  CONNECTOR: "stepper__connector",
  PANELS: "stepper__panels",
  PANEL_WRAPPER: "stepper__panel-wrapper",
  PANEL: "stepper__panel",
  PANEL_INNER: "stepper__panel-inner",
  PANEL_BODY: "stepper__panel-body",
  PANEL_ACTIONS: "stepper__panel-actions",
  COUNT: "stepper__count",
  PROGRESS: "stepper__progress",
  PROGRESS_BAR: "stepper__progress-bar",
  PROGRESS_LABEL: "stepper__progress-label",
} as const;

/** Root and item modifiers, without the prefix */
export const STEPPER_MODIFIERS = {
  HORIZONTAL: "stepper--horizontal",
  VERTICAL: "stepper--vertical",
  AUTO: "stepper--auto",
  LABEL_END: "stepper--label-end",
  LABEL_BOTTOM: "stepper--label-bottom",
  HEADER_TOP: "stepper--header-top",
  HEADER_BOTTOM: "stepper--header-bottom",
  VALIDATING: "stepper--validating",
  DISABLED: "stepper--disabled",
  ACTIVE: "stepper__item--active",
  COMPLETED: "stepper__item--completed",
  EDITABLE: "stepper__item--editable",
  OPTIONAL: "stepper__item--optional",
  ERROR: "stepper__item--error",
  DISABLED_ITEM: "stepper__item--disabled",
  VALIDATING_ITEM: "stepper__item--validating",
  DISPLAY_LABELS: "stepper--display-labels",
  DISPLAY_COUNT: "stepper--display-count",
  DISPLAY_DOTS: "stepper--display-dots",
  DISPLAY_PROGRESS: "stepper--display-progress",
} as const;

/** How much of each step the header list shows */
export const STEPPER_DISPLAYS = {
  LABELS: "labels",
  COUNT: "count",
  DOTS: "dots",
  PROGRESS: "progress",
} as const;

export type StepperDisplay = (typeof STEPPER_DISPLAYS)[keyof typeof STEPPER_DISPLAYS];

/** Defaults every option falls back to */
export const STEPPER_DEFAULTS = {
  ORIENTATION: STEPPER_ORIENTATIONS.HORIZONTAL,
  AUTO_BREAKPOINT: 600,
  LINEAR: false,
  LABEL_PLACEMENT: STEPPER_LABEL_PLACEMENTS.END,
  HEADER_PLACEMENT: STEPPER_HEADER_PLACEMENTS.TOP,
  REPORT_VALIDITY: true,
  VALIDATE_ON_FORWARD: true,
  FOCUS_ON_ACTION: "panel",
  DISPLAY: STEPPER_DISPLAYS.LABELS,
  OPTIONAL_SUPPORTING_TEXT: "Optional",
  ARIA_LABEL: "Progress",
  COMPONENT_NAME: "stepper",
  PREFIX: "mtrl",
} as const;

/** Indicator glyphs, inline so the component needs no asset request */
/** Where focus goes after a panel action changes the step (spec §7) */
export const STEPPER_FOCUS_TARGETS = {
  NONE: "none",
  PANEL: "panel",
  HEADING: "heading",
} as const;

export type StepperFocusTarget = (typeof STEPPER_FOCUS_TARGETS)[keyof typeof STEPPER_FOCUS_TARGETS];

export const STEPPER_ICONS = {
  CHECK:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.55 17.6 4.9 12.95l1.4-1.4 3.25 3.25 8.15-8.15 1.4 1.4z"/></svg>',
  EDIT:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75zM20.7 7.05a1 1 0 0 0 0-1.4l-2.35-2.35a1 1 0 0 0-1.4 0l-1.85 1.85 3.75 3.75z"/></svg>',
  ERROR:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 1 21h22zm1 15h-2v2h2zm0-6h-2v4h2z"/></svg>',
} as const;
