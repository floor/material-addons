import { createEffect, mergeProps, onCleanup, onMount, splitProps, type Component, type JSX } from "solid-js";
import { Dynamic, isServer } from "solid-js/web";
import { toAttribute } from "material/elements";
import {
  changesModel, dispatch, eventKeys, initialize, initialValue, listen, ratingHost, ratingKeys,
  synchronize, tag, type RatingEventProps, type RatingProps,
} from "./contract";
import type { RatingElement } from "../../elements/rating";

type Host = JSX.HTMLAttributes<RatingElement> & { children?: JSX.Element };
export type SolidRatingProps = RatingProps & RatingEventProps & Omit<Host, keyof (RatingProps & RatingEventProps) | "ref"> & { ref?: (node: RatingElement) => void };

function mapped(props: Record<string, unknown>, omitValue = false) {
  const result: Record<string, unknown> = {};
  for (const [key, attribute] of ratingHost.attributes) {
    if (omitValue && attribute.name === "value") continue;
    Object.defineProperty(result, isServer ? attribute.name : `attr:${attribute.name}`, {
      enumerable: true,
      get: () => {
        const value = toAttribute(attribute.type, props[key]);
        return attribute.type === "boolean" && value !== undefined ? true : value;
      },
    });
  }
  return result;
}

export function createSolidRating(): Component<SolidRatingProps> {
  return props => {
    const [own, rest] = splitProps(props, [...ratingKeys, ...eventKeys, "ref"] as (keyof SolidRatingProps)[]);
    let element: RatingElement | undefined;
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
    const defaults = isServer ? { get value() { return initialValue(own); } } : {};
    return Dynamic(mergeProps(rest, mapped(props, true), defaults, {
      component: tag(),
      ref(node: RatingElement) { element = node; props.ref?.(node); },
    }) as never);
  };
}
