// src/components/stepper/index.ts

/**
 * Stepper component module
 * @module components/stepper
 */

export { default as createStepper } from "./stepper";
export { default } from "./stepper";

// Constants
export {
  STEPPER_ACTIONS,
  STEPPER_CLASSES,
  STEPPER_DEFAULTS,
  STEPPER_EVENTS,
  STEPPER_HEADER_PLACEMENTS,
  STEPPER_ICONS,
  STEPPER_LABEL_PLACEMENTS,
  STEPPER_MODIFIERS,
  STEPPER_ORIENTATIONS,
} from "./constants";

// Types
export type {
  StepConfig,
  StepState,
  StepValidationContext,
  StepValidationResult,
  StepValidator,
  StepperBeforeChangeEvent,
  StepperChangeEvent,
  StepperCompleteEvent,
  StepperComponent,
  StepperConfig,
  StepperErrorEvent,
  StepperEventName,
  StepperHeaderPlacement,
  StepperLabelPlacement,
  StepperOrientation,
  StepperOrientationChangeEvent,
  StepperResetEvent,
  StepperResolvedOrientation,
} from "./types";

// Config helpers
export {
  activeValueOf,
  createBaseConfig,
  createInitialState,
  createStepState,
  defaultConfig,
  getElementConfig,
} from "./config";
export { supportingTextOf } from "./features/renderer";
export type { StepperSettings } from "./config";

// Features
export { withAutoOrientation, withKeyboard, withNavigation, withRenderer } from "./features";
export type { Navigation, Renderer, StepperHost } from "./features";
