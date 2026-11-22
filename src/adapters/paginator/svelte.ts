// src/adapters/paginator/svelte.ts

import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import { definePaginator, listenPaginator, synchronizePaginator, type PaginatorElementEventMap, type PaginatorProps } from "../paginator";
import type { PaginatorElement } from "../../elements/paginator";

export { attributes, definePaginator, hostProps, paginatorEventNames, paginatorHost, synchronizePaginator, tag } from "../paginator";

export type SveltePaginatorEvents = {
  onchange?: (event: PaginatorElementEventMap["change"]) => void;
};
export type SveltePaginatorProps = PaginatorProps & SveltePaginatorEvents &
  Omit<HTMLAttributes<HTMLElement>, keyof (PaginatorProps & SveltePaginatorEvents) | "children"> & { children?: Snippet };

interface Binding {
  props: SveltePaginatorProps;
}

export function connectPaginator(node: PaginatorElement, initial: Binding) {
  definePaginator();
  let binding = initial;
  const destroy = listenPaginator(node, (event) => {
    binding.props.onchange?.(event as never);
  });
  synchronizePaginator(node, initial.props);
  return {
    update(next: Binding) {
      binding = next;
      synchronizePaginator(node, next.props);
    },
    destroy,
  };
}
