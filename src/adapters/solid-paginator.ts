// src/adapters/solid-paginator.ts

import { mergeProps, onCleanup, onMount, splitProps, type Component, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import {
  attributes, definePaginator, hostProps, listenPaginator, paginatorKeys, synchronizePaginator, tag,
  type PaginatorProps,
} from "./paginator";
import type { PaginatorElement } from "../elements/paginator";

type Host = JSX.HTMLAttributes<PaginatorElement> & { children?: JSX.Element };
export type SolidPaginatorProps = PaginatorProps & Omit<Host, keyof PaginatorProps | "ref"> & { ref?: (node: PaginatorElement) => void };

export function createSolidPaginator(): Component<SolidPaginatorProps> {
  return (props) => {
    let element: PaginatorElement | undefined;
    onMount(() => {
      definePaginator();
      const node = element;
      if (!node) return;
      onCleanup(listenPaginator(node, (event) => props.onChange?.(event as never)));
      synchronizePaginator(node, props);
    });
    const [rest] = splitProps(props, [...paginatorKeys, "ref"] as (keyof SolidPaginatorProps)[]);
    return Dynamic(mergeProps(rest, hostProps(props, ["onChange", "ref"]), attributes(props), {
      component: tag(),
      ref(node: PaginatorElement) { element = node; props.ref?.(node); },
    }) as never);
  };
}
