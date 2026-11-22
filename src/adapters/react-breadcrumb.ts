// src/adapters/react-breadcrumb.ts

import {
  createElement, forwardRef, useCallback, useEffect, useLayoutEffect, useRef,
  type HTMLAttributes,
} from "react";
import {
  attributes, defineBreadcrumb, hostProps, listenBreadcrumb, synchronizeBreadcrumb, tag,
  type BreadcrumbElementEventMap, type BreadcrumbProps,
} from "./breadcrumb";
import type { BreadcrumbElement } from "../elements/breadcrumb";

export type ReactBreadcrumbProps = BreadcrumbProps & Omit<HTMLAttributes<BreadcrumbElement>, keyof BreadcrumbProps>;

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const dispatch = (props: BreadcrumbProps, name: keyof BreadcrumbElementEventMap, event: Event): void => {
  if (name === "beforechange") props.onBeforechange?.(event as never);
  else props.onChange?.(event as never);
};

export function createReactBreadcrumb() {
  return forwardRef<BreadcrumbElement, ReactBreadcrumbProps>(function Breadcrumb(props, ref) {
    const element = useRef<BreadcrumbElement | null>(null);
    const attach = useCallback((node: BreadcrumbElement | null) => {
      element.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    }, [ref]);
    useClientLayoutEffect(() => {
      defineBreadcrumb();
      const node = element.current;
      if (!node) return;
      const stop = listenBreadcrumb(node, (name, event) => dispatch(props, name, event));
      synchronizeBreadcrumb(node, props);
      return stop;
    });
    useClientLayoutEffect(() => {
      if (element.current?.component) synchronizeBreadcrumb(element.current, props);
    });
    return createElement(tag(), {
      ...hostProps(props, ["onBeforechange", "onChange", "className", "children"]),
      ...attributes(props),
      class: props.className,
      ref: attach,
    }, props.children);
  });
}
