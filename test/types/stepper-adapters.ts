import type { ReactStepperProps } from "../../src/react";
import type { VueStepperEmits, VueStepperProps } from "../../src/vue";
import type { SolidStepperProps } from "../../src/solid";
import type { SvelteStepperEvents, SvelteStepperProps } from "../../src/adapters/svelte";
import type { StepperConfig, StepperEvents } from "../../src/components/stepper";
import type { StepperElementEventMap } from "../../src/elements";

type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type EventOf<T> = T extends (event: infer Event) => unknown ? Event : never;

export type EventMapChecks = [
  Assert<Same<StepperElementEventMap["beforechange"], CustomEvent<StepperEvents["beforechange"]>>>,
  Assert<Same<StepperElementEventMap["validationerror"], CustomEvent<StepperEvents["error"]>>>,
  Assert<Same<EventOf<ReactStepperProps["onBeforechange"]>, StepperElementEventMap["beforechange"]>>,
  Assert<Same<EventOf<VueStepperEmits["beforechange"]>, StepperElementEventMap["beforechange"]>>,
  Assert<Same<EventOf<SolidStepperProps["onValidationerror"]>, StepperElementEventMap["validationerror"]>>,
  Assert<Same<EventOf<SvelteStepperEvents["onvalidationerror"]>, StepperElementEventMap["validationerror"]>>,
];

export type DisplayPropChecks = [
  Assert<Same<ReactStepperProps["display"], StepperConfig["display"]>>,
  Assert<Same<VueStepperProps["display"], StepperConfig["display"]>>,
  Assert<Same<SolidStepperProps["display"], StepperConfig["display"]>>,
  Assert<Same<SvelteStepperProps["display"], StepperConfig["display"]>>,
];
