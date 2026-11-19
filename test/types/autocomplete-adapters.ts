import type { AutocompleteChangeEvent, AutocompleteSelectEvent } from "../../src/components/autocomplete";
import type { AutocompleteElement, AutocompleteElementEventMap } from "../../src/elements/autocomplete";
import type { ReactAutocompleteProps, ReactAutocompleteOptionProps } from "../../src/react";
import type { SolidAutocompleteProps, SolidAutocompleteOptionProps } from "../../src/solid";
import type { VueAutocompleteEmits, VueAutocompleteProps } from "../../src/vue";
import type { SvelteAutocompleteEvents, SvelteAutocompleteProps, SvelteAutocompleteOptionProps } from "../../src/adapters/autocomplete/svelte";

type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type EventOf<T> = T extends (event: infer Event) => unknown ? Event : never;

export type AutocompleteAdapterChecks = [
  Assert<Same<AutocompleteElementEventMap["change"], CustomEvent<AutocompleteChangeEvent>>>,
  Assert<Same<AutocompleteElementEventMap["select"], CustomEvent<AutocompleteSelectEvent>>>,
  Assert<Same<EventOf<ReactAutocompleteProps["onChange"]>, AutocompleteElementEventMap["change"]>>,
  Assert<Same<EventOf<VueAutocompleteEmits["select"]>, AutocompleteElementEventMap["select"]>>,
  Assert<Same<EventOf<SolidAutocompleteProps["onSelect"]>, AutocompleteElementEventMap["select"]>>,
  Assert<Same<EventOf<SvelteAutocompleteEvents["onchange"]>, AutocompleteElementEventMap["change"]>>,
  Assert<Same<ReactAutocompleteProps["noOpenOnFocus"], boolean | undefined>>,
  Assert<Same<VueAutocompleteProps["noOpenOnFocus"], boolean | undefined>>,
  Assert<Same<SolidAutocompleteProps["noOpenOnFocus"], boolean | undefined>>,
  Assert<Same<SvelteAutocompleteProps["noOpenOnFocus"], boolean | undefined>>,
  Assert<Same<ReactAutocompleteOptionProps["supportingText"], string | undefined>>,
  Assert<Same<SolidAutocompleteOptionProps["supportingText"], string | undefined>>,
  Assert<Same<SvelteAutocompleteOptionProps["supportingText"], string | undefined>>,
];

export function readAutocompleteEvent(element: AutocompleteElement) {
  element.addEventListener("select", event => {
    const option: AutocompleteSelectEvent["option"] = event.detail.option;
    return option;
  });
}
