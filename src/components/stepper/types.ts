// src/components/stepper/types.ts

import type { EventCallback } from "material/core/state";
import type {
  STEPPER_HEADER_PLACEMENTS,
  STEPPER_LABEL_PLACEMENTS,
  STEPPER_ORIENTATIONS,
} from "./constants";

/** The layout axis, or `auto` to follow the container width */
export type StepperOrientation =
  (typeof STEPPER_ORIENTATIONS)[keyof typeof STEPPER_ORIENTATIONS];
/** The axis a stepper is actually laid out on */
export type StepperResolvedOrientation = "horizontal" | "vertical";
/** Where the label sits relative to the indicator in horizontal layout */
export type StepperLabelPlacement =
  (typeof STEPPER_LABEL_PLACEMENTS)[keyof typeof STEPPER_LABEL_PLACEMENTS];
/** Where the header list sits relative to the panels in horizontal layout */
export type StepperHeaderPlacement =
  (typeof STEPPER_HEADER_PLACEMENTS)[keyof typeof STEPPER_HEADER_PLACEMENTS];

/** What a validator returns: a boolean, or a result whose copy replaces the supporting text */
export interface StepValidationResult {
  valid: boolean;
  /** Copy shown in place of the step's supporting text while the step is in error */
  supportingText?: string;
}

/** What a validator receives */
export interface StepValidationContext {
  /** The step being validated */
  value: string;
  /** The step the transition would move to, when one is requested */
  targetValue: string | null;
  direction: "forward" | "backward" | "none";
  panel: HTMLElement | null;
  stepper: StepperComponent;
}

/** A per-step or stepper-level validator */
export type StepValidator = (
  step: StepState,
  context: StepValidationContext,
) =>
  | boolean
  | StepValidationResult
  | Promise<boolean | StepValidationResult>;

/** One step's declaration */
export interface StepConfig {
  /** Stable identifier, the step's `value` (defaults to `step-${index}`) */
  value?: string;
  /** Primary label */
  label: string;
  /** Hint, optional caption or validation explanation */
  supportingText?: string;
  /** Custom indicator markup, in place of the step number */
  icon?: string;
  /** Panel content: markup, an element, a fragment, or a render callback */
  content?: string | HTMLElement | DocumentFragment | ((panel: HTMLElement, step: StepState) => void);
  completed?: boolean;
  /** Whether a completed step may be revisited in linear mode */
  editable?: boolean;
  /** Whether the step may be skipped in linear mode */
  optional?: boolean;
  /** Whether the step starts in its error state */
  error?: boolean;
  disabled?: boolean;
  validate?: StepValidator;
}

/** A step's live state, as the getters return it */
export interface StepState {
  value: string;
  index: number;
  label: string;
  supportingText?: string;
  icon?: string;
  completed: boolean;
  editable: boolean;
  optional: boolean;
  error: boolean;
  disabled: boolean;
  active: boolean;
  validating: boolean;
}

/** A vetoable step transition */
export interface StepperBeforeChangeEvent {
  previousValue: string | null;
  /** The destination */
  value: string;
  previousStep: StepState | null;
  step: StepState;
  direction: "forward" | "backward";
  preventDefault: () => void;
  readonly defaultPrevented: boolean;
}

/** A committed step change */
export interface StepperChangeEvent {
  value: string;
  previousValue: string | null;
  step: StepState;
  previousStep: StepState | null;
  direction: "forward" | "backward";
}

/** The last step completed */
export interface StepperCompleteEvent {
  value: string;
  steps: StepState[];
}

/** Validation failed for a step */
export interface StepperErrorEvent {
  value: string;
  step: StepState;
  supportingText?: string;
}

/** reset() moved the active step */
export interface StepperResetEvent {
  value: string | null;
  previousValue: string | null;
}

/** Orientation: "auto" resolved to the other axis */
export interface StepperOrientationChangeEvent {
  orientation: StepperResolvedOrientation;
}

/** An event name the component emits */
export type StepperEventName =
  | "beforechange"
  | "change"
  | "complete"
  | "error"
  | "reset"
  | "orientationchange";

/** Configuration for createStepper */
export interface StepperConfig {
  steps?: StepConfig[];
  /** The initially active step's value (defaults to the first enabled step) */
  value?: string | null;
  orientation?: StepperOrientation;
  /** Container width, in px, below which `orientation: "auto"` lays out vertically */
  autoBreakpoint?: number;
  /** Require every earlier non-optional step to be completed before moving forward */
  linear?: boolean;
  labelPlacement?: StepperLabelPlacement;
  headerPlacement?: StepperHeaderPlacement;
  /** Call reportValidity() on the first invalid control inside a step */
  reportValidity?: boolean;
  /** Run validation on forward moves even when linear is false */
  validateOnForward?: boolean;
  /** Move focus into the newly shown panel after an action button */
  focusPanelOnAction?: boolean;
  /** Supporting text a step shows when it is optional and has none of its own */
  optionalSupportingText?: string;
  /** The root's accessible name */
  ariaLabel?: string;
  /** Indicator glyph overrides */
  icons?: { check?: string; edit?: string; error?: string };
  /** Stepper-level validator */
  validate?: StepValidator;
  disabled?: boolean;
  class?: string;
  componentName?: string;
  onBeforeChange?: (event: StepperBeforeChangeEvent) => void;
  onChange?: (event: StepperChangeEvent) => void;
  onComplete?: (event: StepperCompleteEvent) => void;
  onError?: (event: StepperErrorEvent) => void;
  onReset?: (event: StepperResetEvent) => void;
}

/** The public component */
export interface StepperComponent {
  element: HTMLElement;
  /** Validates the active step, marks it completed and moves to the next enabled one */
  next: () => Promise<boolean>;
  /** Moves to the previous enabled step without completing the one left behind */
  prev: () => Promise<boolean>;
  /** The guarded navigation command */
  goTo: (indexOrValue: number | string) => Promise<boolean>;
  reset: () => StepperComponent;
  validate: (indexOrValue?: number | string) => Promise<boolean>;
  getValue: () => string | null;
  setValue: (value: string | null) => StepperComponent;
  getActiveStep: () => StepState | null;
  /** Index of the active step, -1 when none */
  getActiveIndex: () => number;
  getStep: (indexOrValue: number | string) => StepState | null;
  getSteps: () => StepState[];
  setSteps: (steps: StepConfig[]) => StepperComponent;
  addStep: (step: StepConfig, index?: number) => StepperComponent;
  removeStep: (indexOrValue: number | string) => StepperComponent;
  setStepState: (
    indexOrValue: number | string,
    patch: Partial<Pick<StepConfig, "label" | "supportingText" | "icon" | "completed" | "editable" | "optional" | "error" | "disabled">>,
  ) => StepperComponent;
  completeStep: (indexOrValue?: number | string, completed?: boolean) => StepperComponent;
  setError: (indexOrValue: number | string, error: boolean, supportingText?: string) => StepperComponent;
  getPanelElement: (indexOrValue: number | string) => HTMLElement | null;
  getHeaderElement: (indexOrValue: number | string) => HTMLButtonElement | null;
  setOrientation: (orientation: StepperOrientation) => StepperComponent;
  getResolvedOrientation: () => StepperResolvedOrientation;
  setLinear: (linear: boolean) => StepperComponent;
  enable: () => StepperComponent;
  disable: () => StepperComponent;
  isDisabled: () => boolean;
  on: (event: StepperEventName, handler: EventCallback) => StepperComponent;
  off: (event: StepperEventName, handler: EventCallback) => StepperComponent;
  destroy: () => void;
}
