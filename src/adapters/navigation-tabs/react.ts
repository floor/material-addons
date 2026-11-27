"use client";

import { createElement, forwardRef, useCallback, useEffect, useLayoutEffect, useRef, type HTMLAttributes, type ForwardRefExoticComponent, type RefAttributes } from "react";
import { attributes, connectChange, hostProps, initialize, tag, type NavigationTabsChange, type NavigationTabsProps } from "./contract";
import type { NavigationTabsElement } from "../../elements/navigation-tabs";

export type ReactNavigationTabsProps = NavigationTabsProps & { onChange?: NavigationTabsChange } &
  Omit<HTMLAttributes<NavigationTabsElement>, keyof NavigationTabsProps | "onChange">;

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function createReactNavigationTabs(): ForwardRefExoticComponent<ReactNavigationTabsProps & RefAttributes<NavigationTabsElement>> {
  return forwardRef<NavigationTabsElement, ReactNavigationTabsProps>(function NavigationTabs(props, ref) {
    const element = useRef<NavigationTabsElement | null>(null);
    const connection = useRef<ReturnType<typeof connectChange> | undefined>(undefined);
    useClientLayoutEffect(() => {
      if (!element.current) return;
      initialize();
      connection.current = connectChange(element.current);
      return () => connection.current?.destroy();
    }, []);
    useClientLayoutEffect(() => connection.current?.update(props.onChange));

    const attach = useCallback((node: NavigationTabsElement | null) => {
      element.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    }, [ref]);
    return createElement(tag(), {
      ...hostProps(props, ["onChange", "className", "children"]),
      ...attributes(props), class: props.className, ref: attach,
    }, props.children);
  });
}
