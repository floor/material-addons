import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import {
  changesModel, initialize, listen, synchronize, type StepProps, type StepperProps,
} from "./stepper";
import type { StepperElement, StepperElementEventMap } from "../elements/stepper";

export { attributes, hostProps, initialValue, stepHost, stepperHost, svelteEventKeys, tag } from "./stepper";
export type SvelteStepperEvents = {
  [K in keyof StepperElementEventMap as `on${K}`]?: (event: StepperElementEventMap[K]) => void;
};
export type SvelteStepperProps = StepperProps & SvelteStepperEvents &
  Omit<HTMLAttributes<HTMLElement>, keyof (StepperProps & SvelteStepperEvents) | "children"> & { children?: Snippet };
export type SvelteStepProps = StepProps & Omit<HTMLAttributes<HTMLElement>, keyof StepProps | "children"> & { children?: Snippet };

interface Binding {
  props: SvelteStepperProps;
  set(value: string | null): void;
}

export function connectStepper(node: StepperElement, initial: Binding) {
  let binding = initial;
  const destroy = listen(node, (name, event) => {
    binding.props[`on${name}`]?.(event as never);
    if (changesModel(name)) binding.set(node.value);
  });
  initialize(node, initial.props);
  return {
    update(next: Binding) {
      binding = next;
      synchronize(node, next.props);
    },
    destroy,
  };
}
