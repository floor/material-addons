import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import { changesModel, initialize, listen, synchronize, type RatingProps } from "./contract";
import type { RatingElement, RatingElementEventMap } from "../../elements/rating";

export { attributes, hostProps, initialValue, ratingHost, svelteEventKeys, tag } from "./contract";
export type SvelteRatingEvents = {
  [K in keyof RatingElementEventMap as `on${K}`]?: (event: RatingElementEventMap[K]) => void;
};
export type SvelteRatingProps = RatingProps & SvelteRatingEvents &
  Omit<HTMLAttributes<HTMLElement>, keyof (RatingProps & SvelteRatingEvents) | "children"> & { children?: Snippet };

interface Binding {
  props: SvelteRatingProps;
  set(value: number): void;
}

export function connectRating(node: RatingElement, initial: Binding) {
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
