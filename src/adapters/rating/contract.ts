import { describe, getPrefix, toAttribute, type DefaultProps, type ElementProps } from "material/elements";
import type { RatingConfig } from "../../components/rating/types";
import {
  defineRating, ratingElement, ratingElementEventNames,
  type RatingElement, type RatingElementEventMap, type RatingSpec,
} from "../../elements/rating";

type ElementRatingProps = ElementProps<RatingSpec>;
/** The element chooses the prop names. The factory narrows its option values. */
export type RatingProps = {
  [K in keyof ElementRatingProps]: K extends keyof RatingConfig ? RatingConfig[K] : ElementRatingProps[K];
} & {
  [K in keyof DefaultProps<RatingSpec>]: DefaultProps<RatingSpec>[K] | null;
};
export type RatingEventProps = {
  [K in keyof RatingElementEventMap as `on${Capitalize<K>}`]?: (event: RatingElementEventMap[K]) => void;
};

export const ratingHost = describe(ratingElement.spec);
export const tag = () => `${getPrefix()}-rating`;

export function attributes(props: object, omitValue = false) {
  const result: Record<string, string | undefined> = {};
  for (const [key, attribute] of ratingHost.attributes) {
    if (!omitValue || attribute.name !== "value") result[attribute.name] = toAttribute(attribute.type, (props as Record<string, unknown>)[key]);
  }
  return result;
}

/** Set the authored default before definition, then apply the live prop. */
export function initialize(element: RatingElement, props: RatingProps) {
  const initial = initialValue(props);
  if (initial != null) element.setAttribute("value", String(initial));
  else element.removeAttribute("value");
  defineRating({ prefix: getPrefix() });
  synchronize(element, props);
}

export function synchronize(element: RatingElement, props: RatingProps) {
  if (props.defaultValue === null) element.removeAttribute("value");
  else if (props.defaultValue !== undefined && element.getAttribute("value") !== String(props.defaultValue)) {
    element.setAttribute("value", String(props.defaultValue));
  }
  if (typeof props.value === "number" && element.value !== props.value) element.value = props.value;
}

export function listen(element: RatingElement, receive: (name: keyof RatingElementEventMap, event: Event) => void) {
  const off = ratingElementEventNames.map(name => {
    const handler = (event: Event) => {
      if (event.target === element) receive(name, event);
    };
    element.addEventListener(name, handler);
    return () => element.removeEventListener(name, handler);
  });
  return () => off.forEach(remove => remove());
}

export const changesModel = (name: keyof RatingElementEventMap) => name === "change";
export const callbackName = (name: keyof RatingElementEventMap): keyof RatingEventProps =>
  `on${name[0].toUpperCase()}${name.slice(1)}` as keyof RatingEventProps;

export const eventKeys = ratingElementEventNames.map(callbackName);
export const svelteEventKeys = ratingElementEventNames.map(name => `on${name}`);
export const ratingKeys = [...new Set([...ratingHost.attributes.keys(), ...ratingHost.properties, "defaultValue"])];

export function hostProps(props: object, excluded: readonly string[] = []) {
  const own = new Set([...ratingKeys, ...excluded]);
  return Object.fromEntries(Object.entries(props).filter(([key]) => !own.has(key)));
}

export function initialValue(props: RatingProps) {
  const value = props.defaultValue === undefined ? props.value : props.defaultValue;
  return typeof value === "number" ? value : undefined;
}

export function dispatch(props: RatingEventProps, name: keyof RatingElementEventMap, event: Event) {
  const handler = props[callbackName(name)];
  if (typeof handler === "function") handler(event as never);
}
