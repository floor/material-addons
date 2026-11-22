import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import {
  attributes,
  hostProps,
  initialize,
  listen,
  svelteEventKeys,
  synchronize,
  tag,
  type AlertProps,
} from "./contract";
import type { AlertElement, AlertElementEventMap } from "../../elements/alert";

export { attributes, hostProps, svelteEventKeys, tag };

export type SvelteAlertEvents = {
  [K in keyof AlertElementEventMap as `on${K}`]?: (event: AlertElementEventMap[K]) => void;
};

export type SvelteAlertProps = AlertProps & SvelteAlertEvents & { children?: Snippet } &
  Omit<HTMLAttributes<HTMLElement>, keyof (AlertProps & SvelteAlertEvents) | "children">;

export function connectAlert(node: AlertElement, initial: SvelteAlertProps) {
  let current = initial;
  initialize(node, current);
  const stop = listen(node, (name, event) => {
    current[`on${name}` as keyof SvelteAlertEvents]?.(event as never);
  });
  return {
    update(next: SvelteAlertProps) {
      current = next;
      synchronize(node, current);
    },
    destroy() {
      stop();
    },
  };
}
