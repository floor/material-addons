import { describe, describeDeclaration, getPrefix, toAttribute, type DefaultProps, type ElementProps } from "material/elements";
import {
  defineAutocomplete, autocompleteOptionDeclaration, autocompleteElement, autocompleteElementEventNames,
  type AutocompleteOptionAttributes, type AutocompleteElement, type AutocompleteElementEventMap, type AutocompleteSpec,
} from "../../elements/autocomplete";
import type { AutocompleteConfig } from "../../components/autocomplete/types";

export type AutocompleteOptionProps = Partial<AutocompleteOptionAttributes>;
type ElementAutocompleteProps = ElementProps<AutocompleteSpec>;
/** The element chooses the prop names. The factory narrows its option values. */
export type AutocompleteProps = {
  [K in keyof ElementAutocompleteProps]: K extends keyof AutocompleteConfig ? AutocompleteConfig[K] : ElementAutocompleteProps[K];
} & {
  [K in keyof DefaultProps<AutocompleteSpec>]: DefaultProps<AutocompleteSpec>[K] | null;
};
export type AutocompleteEventProps = {
  [K in keyof AutocompleteElementEventMap as `on${Capitalize<K>}`]?: (event: AutocompleteElementEventMap[K]) => void;
};

export const autocompleteHost = describe(autocompleteElement.spec);
export const optionHost = { attributes: describeDeclaration(autocompleteOptionDeclaration) };
export const tag = (name: "autocomplete" | "autocomplete-option") => `${getPrefix()}-${name}`;

export function attributes(
  host: typeof autocompleteHost | typeof optionHost, props: object, omitValue = false,
) {
  const result: Record<string, string | undefined> = {};
  for (const [key, attribute] of host.attributes) {
    if (!omitValue || attribute.name !== "value") result[attribute.name] = toAttribute(attribute.type, (props as Record<string, unknown>)[key]);
  }
  return result;
}

/** Set the authored default before definition, then apply the live prop. */
export function initialize(element: AutocompleteElement, props: AutocompleteProps) {
  const initial = initialValue(props);
  if (initial != null) element.setAttribute("value", initial);
  else if (initial === null) element.removeAttribute("value");
  defineAutocomplete({ prefix: getPrefix() });
  synchronize(element, props);
}

export function synchronize(element: AutocompleteElement, props: AutocompleteProps) {
  if (props.defaultValue === null) element.removeAttribute("value");
  else if (props.defaultValue !== undefined && element.getAttribute("value") !== props.defaultValue) {
    element.setAttribute("value", props.defaultValue);
  }
  if (props.value !== undefined && element.value !== props.value) element.value = props.value;
}

export function listen(
  element: AutocompleteElement,
  receive: (name: keyof AutocompleteElementEventMap, event: Event) => void,
) {
  const off = autocompleteElementEventNames.map(name => {
    const handler = (event: Event) => {
      if (event.target === element) receive(name, event);
    };
    element.addEventListener(name, handler);
    return () => element.removeEventListener(name, handler);
  });
  return () => off.forEach(remove => remove());
}

export const changesModel = (name: keyof AutocompleteElementEventMap) => name === "change";
export const callbackName = (name: keyof AutocompleteElementEventMap): keyof AutocompleteEventProps =>
  `on${name[0].toUpperCase()}${name.slice(1)}` as keyof AutocompleteEventProps;

export const eventKeys = autocompleteElementEventNames.map(callbackName);
export const svelteEventKeys = autocompleteElementEventNames.map(name => `on${name}`);
export const autocompleteKeys = [...new Set([...autocompleteHost.attributes.keys(), ...autocompleteHost.properties, "defaultValue"])];

export function hostProps(host: typeof autocompleteHost | typeof optionHost, props: object, excluded: readonly string[] = []) {
  const own = new Set([...(host === autocompleteHost ? autocompleteKeys : host.attributes.keys()), ...excluded]);
  return Object.fromEntries(Object.entries(props).filter(([key]) => !own.has(key)));
}

export function initialValue(props: AutocompleteProps) {
  return props.defaultValue === undefined ? props.value : props.defaultValue;
}

export function dispatch(props: AutocompleteEventProps, name: keyof AutocompleteElementEventMap, event: Event) {
  const handler = props[callbackName(name)];
  if (typeof handler === "function") handler(event as never);
}
