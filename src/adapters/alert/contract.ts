import { describe, getPrefix, toAttribute, type ElementProps } from "material/elements";
import type { AlertSeverity, AlertVariant } from "../../components/alert";
import {
  alertElement,
  alertElementEventNames,
  defineAlert,
  type AlertElement,
  type AlertElementEventMap,
  type AlertSpec,
} from "../../elements/alert";

type Attributes = ElementProps<AlertSpec>;
export type AlertProps = Omit<Attributes, "severity" | "variant" | "role"> & {
  severity?: AlertSeverity;
  variant?: AlertVariant;
  role?: "alert" | "status" | "region";
};

export type AlertEventProps = {
  [K in keyof AlertElementEventMap as `on${Capitalize<K>}`]?: (event: AlertElementEventMap[K]) => void;
};

export const alertHost = describe(alertElement.spec);
export const alertKeys = [...new Set([...alertHost.attributes.keys(), ...alertHost.properties])];
export const tag = () => `${getPrefix()}-alert`;
export { alertElementEventNames, defineAlert };

export function attributes(props: AlertProps) {
  const result: Record<string, string> = {};
  for (const [key, attribute] of alertHost.attributes) {
    const value = toAttribute(attribute.type, props[key as keyof AlertProps]);
    if (value !== undefined) result[attribute.name] = value;
  }
  if (props.open === false) result["no-open"] = "";
  return result;
}

export const callbackName = (name: keyof AlertElementEventMap): keyof AlertEventProps =>
  `on${name[0].toUpperCase()}${name.slice(1)}` as keyof AlertEventProps;

export const eventKeys = alertElementEventNames.map(callbackName);
export const svelteEventKeys = alertElementEventNames.map(name => `on${name}`);

export function hostProps(props: object, excluded: readonly string[] = []) {
  const own = new Set([...alertKeys, ...excluded]);
  return Object.fromEntries(Object.entries(props).filter(([key]) => !own.has(key)));
}

export function initialize(element: AlertElement, props: AlertProps) {
  defineAlert({ prefix: getPrefix() });
  synchronize(element, props);
}

export function synchronize(element: AlertElement, props: AlertProps) {
  if (props.open !== undefined && element.open !== props.open) {
    element.open = props.open;
  }
}

export function listen(
  element: AlertElement,
  receive: (name: keyof AlertElementEventMap, event: Event) => void,
) {
  const off = alertElementEventNames.map(name => {
    const handler = (event: Event) => {
      if (event.target === element) receive(name, event);
    };
    element.addEventListener(name, handler);
    return () => element.removeEventListener(name, handler);
  });
  return () => off.forEach(remove => remove());
}

export function dispatch(props: AlertEventProps, name: keyof AlertElementEventMap, event: Event) {
  const handler = props[callbackName(name)];
  if (typeof handler === "function") handler(event as never);
}
