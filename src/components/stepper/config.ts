// src/components/stepper/config.ts

import type { withElement } from "material/core/compose";
import { STEPPER_CLASSES, STEPPER_DEFAULTS, STEPPER_MODIFIERS } from "./constants";
import type { StepConfig, StepState, StepperConfig } from "./types";

/** Defaults every option falls back to */
export const defaultConfig: StepperConfig = {
  steps: [],
  value: null,
  orientation: STEPPER_DEFAULTS.ORIENTATION,
  autoBreakpoint: STEPPER_DEFAULTS.AUTO_BREAKPOINT,
  linear: STEPPER_DEFAULTS.LINEAR,
  labelPlacement: STEPPER_DEFAULTS.LABEL_PLACEMENT,
  headerPlacement: STEPPER_DEFAULTS.HEADER_PLACEMENT,
  reportValidity: STEPPER_DEFAULTS.REPORT_VALIDITY,
  validateOnForward: STEPPER_DEFAULTS.VALIDATE_ON_FORWARD,
  focusOnAction: STEPPER_DEFAULTS.FOCUS_ON_ACTION,
  optionalSupportingText: STEPPER_DEFAULTS.OPTIONAL_SUPPORTING_TEXT,
  ariaLabel: STEPPER_DEFAULTS.ARIA_LABEL,
  disabled: false,
  componentName: STEPPER_DEFAULTS.COMPONENT_NAME,
};

/** The settings every feature reads: the caller's, with the defaults filled in */
export interface StepperSettings extends StepperConfig {
  orientation: NonNullable<StepperConfig["orientation"]>;
  autoBreakpoint: number;
  linear: boolean;
  labelPlacement: NonNullable<StepperConfig["labelPlacement"]>;
  headerPlacement: NonNullable<StepperConfig["headerPlacement"]>;
  reportValidity: boolean;
  validateOnForward: boolean;
  focusOnAction: NonNullable<StepperConfig["focusOnAction"]>;
  optionalSupportingText: string;
  ariaLabel: string;
  disabled: boolean;
  componentName: string;
}

/** Merges the caller's configuration with the defaults */
export const createBaseConfig = (config: StepperConfig = {}): StepperSettings => ({
  ...defaultConfig,
  ...config,
  // The caller's class is kept as given; the root adds the BEM classes beside it
  class: config.class,
}) as StepperSettings;

/** One step's live state, from its declaration and its value */
export const createStepState = (step: StepConfig, index: number): StepState => ({
  value: step.value ?? `step-${index}`,
  index,
  label: step.label,
  supportingText: step.supportingText,
  icon: step.icon,
  completed: step.completed === true,
  editable: step.editable !== false,
  optional: step.optional === true,
  error: step.error === true,
  disabled: step.disabled === true,
  active: false,
  validating: false,
});

/** The initial step states, with the requested value active (the first enabled step when none is) */
export const createInitialState = (
  steps: StepConfig[] = [],
  value: string | null = null,
): StepState[] => {
  const states = steps.map(createStepState);
  const wanted = value === null ? null : states.find((state) => state.value === value);
  const active = wanted && !wanted.disabled ? wanted : states.find((state) => !state.disabled);
  if (active) active.active = true;
  return states;
};

/** The index of a step value, -1 when the list has none */
export const indexOfValue = (steps: StepState[], value: string): number =>
  steps.findIndex((step) => step.value === value);

/**
 * Whether a step may be activated: enabled, and reachable under the linear
 * guard. The renderer marks the rest aria-disabled; navigation refuses them.
 */
export const canReach = (steps: StepState[], index: number, linear: boolean): boolean => {
  const target = steps[index];
  if (!target || target.disabled) return false;
  if (!linear) return true;
  const from = steps.findIndex((step) => step.active);
  if (from < 0 || from === index) return true;
  if (index < from) return !(target.completed && !target.editable);
  for (let j = from + 1; j < index; j++) {
    const step = steps[j];
    if (step && !step.completed && !step.optional) return false;
  }
  return true;
};

/** The active value, or null when no step can be active */
export const activeValueOf = (steps: StepState[]): string | null =>
  steps.find((step) => step.active)?.value ?? null;

/** What withElement builds the root from */
export const getElementConfig = (
  settings: StepperSettings,
): Parameters<typeof withElement>[0] => {
  const prefix = STEPPER_DEFAULTS.PREFIX;
  const className = [
    `${prefix}-${STEPPER_CLASSES.ROOT}`,
    `${prefix}-${STEPPER_MODIFIERS.HORIZONTAL}`,
    `${prefix}-${STEPPER_MODIFIERS.LABEL_END}`,
    `${prefix}-${STEPPER_MODIFIERS.HEADER_TOP}`,
    settings.class,
  ].filter((name): name is string => Boolean(name));

  return {
    tag: "div",
    componentName: settings.componentName,
    className,
    attributes: {
      role: "group",
      "aria-label": settings.ariaLabel,
    },
    interactive: true,
  };
};

/** What the API layer reads off the component */
export const getApiConfig = (component: {
  element: HTMLElement;
  getClass: (name: string) => string;
  emit: (event: string, data?: unknown) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  off: (event: string, handler: (...args: unknown[]) => void) => unknown;
}) => component;
