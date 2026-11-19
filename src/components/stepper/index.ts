// src/components/stepper/index.ts

/**
 * Stepper component module
 *
 * The barrel exports the factory and its public types only. The constants and
 * the config and feature helpers are internal: read them from
 * `material-addons/components/stepper/constants`, and call the factory.
 *
 * @module components/stepper
 */

export { default as createStepper } from "./stepper";
export { default } from "./stepper";

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
  StepperEvents,
  StepperHeaderPlacement,
  StepperLabelPlacement,
  StepperOrientation,
  StepperOrientationChangeEvent,
  StepperResetEvent,
  StepperResolvedOrientation,
} from "./types";
