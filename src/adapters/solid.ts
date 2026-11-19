import { createEffect, mergeProps, onCleanup, onMount, splitProps, type Component, type JSX } from "solid-js";
import { Dynamic, isServer } from "solid-js/web";
import {
  changesModel, dispatch, eventKeys, initialize, initialValue, listen, stepHost,
  stepperHost, stepperKeys, synchronize, tag, type StepProps, type StepperEventProps, type StepperProps,
} from "./stepper";
import { toAttribute } from "material/elements";
import type { StepperElement } from "../elements/stepper";

type Host<E extends HTMLElement> = JSX.HTMLAttributes<E> & { children?: JSX.Element };
export type SolidStepperProps = StepperProps & StepperEventProps & Omit<Host<StepperElement>, keyof (StepperProps & StepperEventProps) | "ref"> & { ref?: (node: StepperElement) => void };
export type SolidStepProps = StepProps & Omit<Host<HTMLElement>, keyof StepProps>;

function mapped(host: typeof stepHost | typeof stepperHost, props: Record<string, unknown>, omitValue = false) {
  const result: Record<string, unknown> = {};
  for (const [key, attribute] of host.attributes) {
    if (omitValue && attribute.name === "value") continue;
    // Solid writes custom-element props even before the tag upgrades. Step
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

export function createSolidStepper(): Component<SolidStepperProps> {
  return props => {
    const [own, rest] = splitProps(props, [...stepperKeys, ...eventKeys, "ref"] as (keyof SolidStepperProps)[]);
    let element: StepperElement | undefined;
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
    return Dynamic(mergeProps(rest, mapped(stepperHost, props, true), defaults, {
      component: tag("stepper"),
      ref(node: StepperElement) { element = node; props.ref?.(node); },
    }) as never);
  };
}

export function createSolidStep(): Component<SolidStepProps> {
  return props => {
    const [, rest] = splitProps(props, [...stepHost.attributes.keys()] as (keyof SolidStepProps)[]);
    return Dynamic(mergeProps(rest, mapped(stepHost, props), { component: tag("step") }) as never);
  };
}
