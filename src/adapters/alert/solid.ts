import { createEffect, mergeProps, onCleanup, onMount, splitProps, type Component, type JSX } from "solid-js";
import { Dynamic, isServer } from "solid-js/web";
import { toAttribute } from "material/elements";
import {
  alertHost,
  alertKeys,
  dispatch,
  eventKeys,
  initialize,
  listen,
  synchronize,
  tag,
  type AlertEventProps,
  type AlertProps,
} from "./contract";
import type { AlertElement } from "../../elements/alert";

export type SolidAlertProps = AlertProps & AlertEventProps & { ref?: (element: AlertElement) => void } &
  Omit<JSX.HTMLAttributes<AlertElement>, keyof (AlertProps & AlertEventProps) | "ref">;

export function createSolidAlert(): Component<SolidAlertProps> {
  return props => {
    const [, rest] = splitProps(props, [...alertKeys, ...eventKeys, "ref"] as (keyof SolidAlertProps)[]);
    let element: AlertElement | undefined;
    onMount(() => {
      const node = element;
      if (!node) return;
      initialize(node, props);
      createEffect(() => synchronize(node, props));
      onCleanup(listen(node, (name, event) => dispatch(props, name, event)));
    });
    const mapped: Record<string, unknown> = {};
    for (const [key, attribute] of alertHost.attributes) {
      Object.defineProperty(mapped, isServer ? attribute.name : `attr:${attribute.name}`, {
        enumerable: true,
        get() {
          const value = toAttribute(attribute.type, props[key as keyof AlertProps]);
          return attribute.type === "boolean" && value !== undefined ? true : value;
        },
      });
    }
    return Dynamic(mergeProps(rest, mapped, {
      component: tag(),
      ref(node: AlertElement) { element = node; props.ref?.(node); },
    }) as never);
  };
}
