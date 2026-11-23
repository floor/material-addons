// src/adapters/react-paginator.ts

import {
  createElement, forwardRef, useCallback, useEffect, useLayoutEffect, useRef,
  type HTMLAttributes,
} from "react";
import {
  attributes, definePaginator, hostProps, listenPaginator, synchronizePaginator, tag,
  type PaginatorProps,
} from "./paginator";
import type { PaginatorElement } from "../elements/paginator";

export type ReactPaginatorProps = PaginatorProps & Omit<HTMLAttributes<PaginatorElement>, keyof PaginatorProps>;

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function createReactPaginator() {
  return forwardRef<PaginatorElement, ReactPaginatorProps>(function Paginator(props, ref) {
    const element = useRef<PaginatorElement | null>(null);
    const attach = useCallback((node: PaginatorElement | null) => {
      element.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    }, [ref]);
    useClientLayoutEffect(() => {
      definePaginator();
      const node = element.current;
      if (!node) return;
      const stop = listenPaginator(node, (event) => props.onChange?.(event as never));
      synchronizePaginator(node, props);
      return stop;
    });
    // Model props that change between renders
    useClientLayoutEffect(() => {
      if (element.current?.component) synchronizePaginator(element.current, props);
    });
    return createElement(tag(), {
      ...hostProps(props, ["onChange", "className", "children"]),
      ...attributes(props),
      class: props.className,
      ref: attach,
    }, props.children);
  });
}
