import { describe, describeDeclaration, getPrefix, toAttribute } from "material/elements";
import {
  defineStepper, stepDeclaration, stepperElement, stepperElementEventNames,
  type StepAttributes, type StepperElement, type StepperElementEventMap,
} from "../elements/stepper";
import type { StepperConfig } from "../components/stepper/types";

export type StepProps = Partial<StepAttributes>;
export type StepperProps = Pick<StepperConfig,
  "orientation" | "autoBreakpoint" | "linear" | "labelPlacement" | "headerPlacement" |
  "optionalSupportingText" | "disabled" | "value"> & {
  defaultValue?: string | null;
  noReportValidity?: boolean;
  ariaLabel?: string;
};
export type StepperEventProps = {
  [K in keyof StepperElementEventMap as `on${Capitalize<K>}`]?: (event: StepperElementEventMap[K]) => void;
};

export const stepperHost = describe(stepperElement.spec);
export const stepHost = { attributes: describeDeclaration(stepDeclaration) };
export const tag = (name: "stepper" | "step") => `${getPrefix()}-${name}`;

export function attributes(
  host: typeof stepperHost | typeof stepHost, props: object, omitValue = false,
) {
  const result: Record<string, string | undefined> = {};
  for (const [key, attribute] of host.attributes) {
    if (!omitValue || attribute.name !== "value") result[attribute.name] = toAttribute(attribute.type, (props as Record<string, unknown>)[key]);
  }
  return result;
}

/** Set the authored default before definition, then apply the live prop. */
export function initialize(element: StepperElement, props: StepperProps) {
  const initial = initialValue(props);
  if (initial != null) element.setAttribute("value", initial);
  else if (initial === null) element.removeAttribute("value");
  defineStepper({ prefix: getPrefix() });
  synchronize(element, props);
}

export function synchronize(element: StepperElement, props: StepperProps) {
  if (props.defaultValue === null) element.removeAttribute("value");
  else if (props.defaultValue !== undefined && element.getAttribute("value") !== props.defaultValue) {
    element.setAttribute("value", props.defaultValue);
  }
  if (props.value !== undefined && element.value !== props.value) element.value = props.value;
}

export function listen(
  element: StepperElement,
  receive: (name: keyof StepperElementEventMap, event: Event) => void,
) {
  const off = stepperElementEventNames.map(name => {
    const handler = (event: Event) => {
      if (event.target === element) receive(name, event);
    };
    element.addEventListener(name, handler);
    return () => element.removeEventListener(name, handler);
  });
  return () => off.forEach(remove => remove());
}

export const changesModel = (name: keyof StepperElementEventMap) => name === "change" || name === "reset";
export const callbackName = (name: keyof StepperElementEventMap): keyof StepperEventProps =>
  `on${name[0].toUpperCase()}${name.slice(1)}` as keyof StepperEventProps;

export const eventKeys = stepperElementEventNames.map(callbackName);
export const svelteEventKeys = stepperElementEventNames.map(name => `on${name}`);
export const stepperKeys = [...new Set([...stepperHost.attributes.keys(), ...stepperHost.properties, "defaultValue"])];

export function hostProps(host: typeof stepperHost | typeof stepHost, props: object, excluded: readonly string[] = []) {
  const own = new Set([...(host === stepperHost ? stepperKeys : host.attributes.keys()), ...excluded]);
  return Object.fromEntries(Object.entries(props).filter(([key]) => !own.has(key)));
}

export function initialValue(props: StepperProps) {
  return props.defaultValue === undefined ? props.value : props.defaultValue;
}

export function dispatch(props: StepperEventProps, name: keyof StepperElementEventMap, event: Event) {
  const handler = props[callbackName(name)];
  if (typeof handler === "function") handler(event as never);
}
