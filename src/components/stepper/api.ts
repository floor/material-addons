// src/components/stepper/api.ts

import type { StepConfig, StepState, StepperComponent, StepperOrientation } from "./types";
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
        return api;
      },
      validate: navigation.validate,
      getValue: navigation.getValue,
      setValue: navigation.setValue,
      getActiveStep: () => {
        const step = core.steps.find((candidate) => candidate.active);
        return step ? { ...step } : null;
      },
      getStep: (target: number | string) => {
        const index = typeof target === "number" ? target : core.steps.findIndex((step) => step.value === target);
        const step = core.steps[index];
        return step ? { ...step } : null;
      },
      getSteps: () => core.steps.map((step) => ({ ...step })),
      setSteps: (steps: StepConfig[]) => {
        navigation.setSteps(steps);
        return api;
      },
      addStep: (step: StepConfig, index?: number) => {
        navigation.addStep(step, index);
        return api;
      },
      removeStep: (target: number | string) => {
        navigation.removeStep(target);
        return api;
      },
      setStepState: (target: number | string, patch: Partial<StepConfig>) => {
        navigation.setStepState(target, patch);
        return api;
      },
      completeStep: (target?: number | string, completed = true) => {
        navigation.completeStep(target, completed);
        return api;
      },
      setError: (target: number | string, error: boolean, supportingText?: string) => {
        navigation.setError(target, error, supportingText);
        return api;
      },
      getPanelElement: navigation.getPanelElement,
      getHeaderElement: navigation.getHeaderElement,
      setOrientation: (orientation: StepperOrientation) => {
        core.setOrientation(orientation);
        core.sync();
        return api;
      },
      getResolvedOrientation: core.resolved,
      setLinear: (linear: boolean) => {
        navigation.setLinear(linear);
        return api;
      },
      enable: () => {
        disabled.enable();
        return api;
      },
      disable: () => {
        disabled.disable();
        return api;
      },
      isDisabled: () => disabled.isDisabled(),
      on: (event, handler) => {
        on(event, handler as (...args: unknown[]) => void);
        return api;
      },
      off: (event, handler) => {
        off(event, handler as (...args: unknown[]) => void);
        return api;
      },
      destroy: () => {
        lifecycle.destroy();
      },
    };

    return Object.assign(component, api) as unknown as StepperComponent;
  };
