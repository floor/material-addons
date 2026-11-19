import type { ReactStepperProps } from "../../src/react";
import type { VueStepperEmits } from "../../src/vue";
import type { SolidStepperProps } from "../../src/solid";
import type { SvelteStepperEvents } from "../../src/adapters/svelte";
import type { StepperEvents } from "../../src/components/stepper";
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
