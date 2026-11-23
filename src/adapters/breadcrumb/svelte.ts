// src/adapters/breadcrumb/svelte.ts

import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import {
  defineBreadcrumb, listenBreadcrumb, synchronizeBreadcrumb,
  type BreadcrumbElementEventMap, type BreadcrumbProps,
} from "../breadcrumb";
import type { BreadcrumbElement } from "../../elements/breadcrumb";

export { attributes, defineBreadcrumb, hostProps, breadcrumbHost, synchronizeBreadcrumb, tag } from "../breadcrumb";

export type SvelteBreadcrumbEvents = {
  onbeforechange?: (event: BreadcrumbElementEventMap["beforechange"]) => void;
  onchange?: (event: BreadcrumbElementEventMap["change"]) => void;
};
export type SvelteBreadcrumbProps = BreadcrumbProps & SvelteBreadcrumbEvents &
  Omit<HTMLAttributes<HTMLElement>, keyof (BreadcrumbProps & SvelteBreadcrumbEvents) | "children"> & { children?: Snippet };

interface Binding {
  props: SvelteBreadcrumbProps;
}

export function connectBreadcrumb(node: BreadcrumbElement, initial: Binding) {
  defineBreadcrumb();
  let binding = initial;
  const destroy = listenBreadcrumb(node, (name, event) => {
    if (name === "beforechange") binding.props.onbeforechange?.(event as never);
    else binding.props.onchange?.(event as never);
  });
  synchronizeBreadcrumb(node, initial.props);
  return {
    update(next: Binding) {
      binding = next;
      synchronizeBreadcrumb(node, next.props);
    },
    destroy,
  };
}
