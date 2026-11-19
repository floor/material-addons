// src/components/stepper/stepper.ts

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createBase, pipe, withDisabled, withElement, withEvents, withLifecycle } from "material/core/compose";
import { createBaseConfig, createInitialState, getElementConfig, type StepperSettings } from "./config";
import { withAPI, getApiConfig, type StepperCore } from "./api";
import { withAutoOrientation } from "./features/orientation";
import { withKeyboard } from "./features/keyboard";
import { withNavigation, type Navigation } from "./features/navigation";
import { withRenderer } from "./features/renderer";
import type { StepState, StepperComponent, StepperConfig, StepperOrientation } from "./types";

export type { StepperComponent };

/**
 * The stepper's own core: the shared state the renderer, navigation, keyboard
 * and orientation features read and write.
 */
const withStepperCore =
  (settings: StepperSettings) =>
  (component: any): any => {
    const steps: StepState[] = createInitialState(settings.steps ?? [], settings.value ?? null);
    const declarations = (settings.steps ?? []).map((step) => ({ ...step }));

    const renderer = withRenderer(settings)(component);
    const orientation = withAutoOrientation(component, settings);

    const context = {
      settings,
      renderer,
      declarations,
      steps,
      validating: false,
      resolved: () => orientation.resolved(),
      component,
    };

    const navigation: Navigation = withNavigation(context, component) as Navigation;

    const sync = (): void => {
      renderer.sync(steps, orientation.resolved());
    };

    renderer.render(steps, declarations.map((declaration) => declaration.content));
    sync();
    orientation.onChange(sync);

    const cleanupKeyboard = withKeyboard(
      component,
      renderer,
      navigation,
      () => orientation.resolved() === "vertical",
      (index: number) => navigation.goTo(index),
    );

    const originalDestroy = component.lifecycle.destroy;
    component.lifecycle.destroy = () => {
      cleanupKeyboard();
      orientation.destroy();
      navigation.destroy();
      renderer.destroy();
      originalDestroy.call(component.lifecycle);
    };

    const setOrientation = (next: StepperOrientation): void => {
      settings.orientation = next;
      // The new axis is resolved and the classes follow it, not the old one
      orientation.refresh();
      sync();
    };

    const core: StepperCore = {
      settings,
      steps,
      renderer,
      navigation,
      setOrientation,
      resolved: () => orientation.resolved(),
      sync,
    };

    return { ...component, stepper: core };
  };

/**
 * Creates a stepper: an ordered list of step headers over one panel at a time,
 * with linear or free progression, a validation pipeline and a value model.
 *
 * @example
 * ```ts
 * const stepper = createStepper({
 *   steps: [
 *     { value: 'account', label: 'Account details' },
 *     { value: 'address', label: 'Shipping address', optional: true },
 *     { value: 'review', label: 'Review & submit' },
 *   ],
 *   linear: true,
 *   onChange: ({ value }) => console.log('step', value),
 * });
 * document.body.append(stepper.element);
 * ```
 */
export const createStepper = (config: StepperConfig = {}): StepperComponent => {
  const settings = createBaseConfig(config);

  const stepper = pipe(
    createBase,
    withEvents(),
    withElement(getElementConfig(settings)),
    withDisabled(settings),
    withLifecycle(),
    withStepperCore(settings),
    (component: any) => withAPI(getApiConfig(component))(component),
  )(settings as any) as StepperComponent;

  return stepper;
};

export default createStepper;
