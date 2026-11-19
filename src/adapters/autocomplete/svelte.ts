import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import {
  changesModel, initialize, listen, synchronize, type AutocompleteOptionProps, type AutocompleteProps,
} from "./contract";
import type { AutocompleteElement, AutocompleteElementEventMap } from "../../elements/autocomplete";

export { attributes, hostProps, initialValue, optionHost, autocompleteHost, svelteEventKeys, tag } from "./contract";
export type SvelteAutocompleteEvents = {
  [K in keyof AutocompleteElementEventMap as `on${K}`]?: (event: AutocompleteElementEventMap[K]) => void;
};
export type SvelteAutocompleteProps = AutocompleteProps & SvelteAutocompleteEvents &
  Omit<HTMLAttributes<HTMLElement>, keyof (AutocompleteProps & SvelteAutocompleteEvents) | "children"> & { children?: Snippet };
export type SvelteAutocompleteOptionProps = AutocompleteOptionProps & Omit<HTMLAttributes<HTMLElement>, keyof AutocompleteOptionProps | "children"> & { children?: Snippet };

interface Binding {
  props: SvelteAutocompleteProps;
  set(value: string | null): void;
}

export function connectAutocomplete(node: AutocompleteElement, initial: Binding) {
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
