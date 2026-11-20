import type { ReactRatingProps } from "../../src/react";
import type { VueRatingProps, VueRatingEmits } from "../../src/vue";
import type { SolidRatingProps } from "../../src/solid";
import type { SvelteRatingProps } from "../../src/adapters/rating/svelte";
import type { RatingElementEventMap } from "../../src/elements/rating";

type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type EventOf<T> = T extends (event: infer Event) => unknown ? Event : never;

export type RatingAdapterChecks = [
  Assert<Same<EventOf<NonNullable<ReactRatingProps["onChange"]>>, RatingElementEventMap["change"]>>,
  Assert<Same<EventOf<NonNullable<ReactRatingProps["onHover"]>>, RatingElementEventMap["hover"]>>,
  Assert<Same<VueRatingEmits["change"], (event: RatingElementEventMap["change"]) => true>>,
  Assert<Same<VueRatingEmits["update:modelValue"], (value: number) => true>>,
  Assert<Same<EventOf<NonNullable<SolidRatingProps["onChange"]>>, RatingElementEventMap["change"]>>,
  Assert<Same<EventOf<NonNullable<SvelteRatingProps["onchange"]>>, RatingElementEventMap["change"]>>,
  Assert<Same<EventOf<NonNullable<SvelteRatingProps["onhover"]>>, RatingElementEventMap["hover"]>>,
  Assert<Same<ReactRatingProps["value"], number | undefined>>,
  Assert<Same<ReactRatingProps["half"], boolean | undefined>>,
  Assert<Same<SvelteRatingProps["readOnly"], boolean | undefined>>,
];
