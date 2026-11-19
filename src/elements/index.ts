// src/elements/index.ts
/**
 * The element layer: the components as custom elements.
 *
 * Importing registers nothing and touches no DOM, so this module is safe on a
 * server. In the browser, import a component's CSS
 * (`material-addons/elements/css/stepper`), then call its `define*` function.
 *
 * @module elements
 */

export { stepperElement, stepDeclaration, defineStepper } from "./stepper";
export type { StepperElement, StepAttributes } from "./stepper";
