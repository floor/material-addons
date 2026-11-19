// src/components/stepper/api.ts

import type { StepConfig, StepState, StepperComponent, StepperConfig, StepperOrientation } from "./types";
import type { Navigation } from "./features/navigation";
import type { Renderer } from "./features/renderer";
import type { StepperSettings } from "./config";

/** What the core feature leaves on the component */
export interface StepperCore {
  settings: StepperSettings;
  steps: StepState[];
  renderer: Renderer;
  navigation: Navigation;
  setOrientation: (orientation: StepperOrientation) => void;
  setDisplay: (display: NonNullable<StepperConfig["display"]> | null) => void;
  resolved: () => "horizontal" | "vertical";
  sync: () => void;
}

/** API configuration options for the stepper component */
interface ApiOptions {
  element: HTMLElement;
  config: StepperSettings;
  emit: (event: string, data?: unknown) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  off: (event: string, handler: (...args: unknown[]) => void) => unknown;
  disabled: { enable: () => void; disable: () => void; isDisabled: () => boolean };
  lifecycle: { destroy: () => void };
  stepper: StepperCore;
}

export const getApiConfig = (comp: unknown): ApiOptions => comp as ApiOptions;

/** Adds the public method surface to the composed component */
export const withAPI =
  (options: ApiOptions) =>
  (component: Record<string, unknown>): StepperComponent => {
    const core = options.stepper;
    const navigation = core.navigation;
    // The composed component's own event, disabled and lifecycle features, taken
    // before the API's methods land on it (they would call themselves otherwise)
    const { on, off, disabled, lifecycle } = options;

    const api: StepperComponent = {
      element: options.element,
      next: navigation.next,
      prev: navigation.prev,
      goTo: navigation.goTo,
      reset: () => {
        navigation.reset();
        return component as unknown as StepperComponent;
      },
      validate: navigation.validate,
      getValue: navigation.getValue,
      setValue: (value) => {
        navigation.setValue(value);
        return component as unknown as StepperComponent;
      },
      getActiveStep: () => {
        const step = core.steps.find((candidate) => candidate.active);
        return step ? { ...step } : null;
      },
      getActiveIndex: navigation.getActiveIndex,
      getStep: (target: number | string) => {
        const index = typeof target === "number" ? target : core.steps.findIndex((step) => step.value === target);
        const step = core.steps[index];
        return step ? { ...step } : null;
      },
      getSteps: () => core.steps.map((step) => ({ ...step })),
      setSteps: (steps: StepConfig[]) => {
        navigation.setSteps(steps);
        return component as unknown as StepperComponent;
      },
      addStep: (step: StepConfig, index?: number) => {
        navigation.addStep(step, index);
        return component as unknown as StepperComponent;
      },
      removeStep: (target: number | string) => {
        navigation.removeStep(target);
        return component as unknown as StepperComponent;
      },
      setStepState: (target: number | string, patch: Partial<StepConfig>) => {
        navigation.setStepState(target, patch);
        return component as unknown as StepperComponent;
      },
      completeStep: (target?: number | string, completed = true) => {
        navigation.completeStep(target, completed);
        return component as unknown as StepperComponent;
      },
      setError: (target: number | string, error: boolean, supportingText?: string) => {
        navigation.setError(target, error, supportingText);
        return component as unknown as StepperComponent;
      },
      getPanelElement: navigation.getPanelElement,
      getHeaderElement: navigation.getHeaderElement,
      setOrientation: (orientation: StepperOrientation) => {
        core.setOrientation(orientation);
        return component as unknown as StepperComponent;
      },
      setDisplay: (display) => {
        core.setDisplay(display);
        return component as unknown as StepperComponent;
      },
      getResolvedOrientation: core.resolved,
      setLinear: (linear: boolean) => {
        navigation.setLinear(linear);
        return component as unknown as StepperComponent;
      },
      enable: () => {
        disabled.enable();
        core.sync();
        return component as unknown as StepperComponent;
      },
      disable: () => {
        disabled.disable();
        core.sync();
        return component as unknown as StepperComponent;
      },
      isDisabled: () => disabled.isDisabled(),
      on: (event, handler) => {
        on(event, handler as (...args: unknown[]) => void);
        return component as unknown as StepperComponent;
      },
      off: (event, handler) => {
        off(event, handler as (...args: unknown[]) => void);
        return component as unknown as StepperComponent;
      },
      destroy: () => {
        lifecycle.destroy();
      },
    };

    return Object.assign(component, api) as unknown as StepperComponent;
  };
