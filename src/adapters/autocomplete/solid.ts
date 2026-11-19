import { createEffect, mergeProps, onCleanup, onMount, splitProps, type Component, type JSX } from "solid-js";
import { Dynamic, isServer } from "solid-js/web";
import {
  changesModel, dispatch, eventKeys, initialize, initialValue, listen, optionHost,
  autocompleteHost, autocompleteKeys, synchronize, tag, type AutocompleteOptionProps, type AutocompleteEventProps, type AutocompleteProps,
} from "./contract";
import { toAttribute } from "material/elements";
import type { AutocompleteElement } from "../../elements/autocomplete";

type Host<E extends HTMLElement> = JSX.HTMLAttributes<E> & { children?: JSX.Element };
export type SolidAutocompleteProps = AutocompleteProps & AutocompleteEventProps & Omit<Host<AutocompleteElement>, keyof (AutocompleteProps & AutocompleteEventProps) | "ref"> & { ref?: (node: AutocompleteElement) => void };
export type SolidAutocompleteOptionProps = AutocompleteOptionProps & Omit<Host<HTMLElement>, keyof AutocompleteOptionProps>;

function mapped(host: typeof optionHost | typeof autocompleteHost, props: Record<string, unknown>, omitValue = false) {
  const result: Record<string, unknown> = {};
  for (const [key, attribute] of host.attributes) {
    if (omitValue && attribute.name === "value") continue;
    // Solid writes custom-element props even before the tag upgrades. Option
    // declarations are read from attributes, so write those explicitly.
    Object.defineProperty(result, isServer ? attribute.name : `attr:${attribute.name}`, {
      enumerable: true, get: () => {
        const value = toAttribute(attribute.type, props[key]);
        return attribute.type === "boolean" && value !== undefined ? true : value;
      },
    });
  }
  return result;
}

export function createSolidAutocomplete(): Component<SolidAutocompleteProps> {
  return props => {
    const [own, rest] = splitProps(props, [...autocompleteKeys, ...eventKeys, "ref"] as (keyof SolidAutocompleteProps)[]);
    let element: AutocompleteElement | undefined;
    onMount(() => {
      const node = element;
      if (!node) return;
      const stop = listen(node, (name, event) => {
        dispatch(own, name, event);
        if (changesModel(name)) queueMicrotask(() => { if (node.isConnected) synchronize(node, own); });
      });
      onCleanup(stop);
      initialize(node, own);
      createEffect(() => synchronize(node, own));
    });
    const defaults = isServer ? { get value() { return initialValue(own) ?? undefined; } } : {};
    return Dynamic(mergeProps(rest, mapped(autocompleteHost, props, true), defaults, {
      component: tag("autocomplete"),
      ref(node: AutocompleteElement) { element = node; props.ref?.(node); },
    }) as never);
  };
}

export function createSolidAutocompleteOption(): Component<SolidAutocompleteOptionProps> {
  return props => {
    const [, rest] = splitProps(props, [...optionHost.attributes.keys()] as (keyof SolidAutocompleteOptionProps)[]);
    return Dynamic(mergeProps(rest, mapped(optionHost, props), { component: tag("autocomplete-option") }) as never);
  };
}
