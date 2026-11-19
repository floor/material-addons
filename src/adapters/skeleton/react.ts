"use client";

import { createElement, forwardRef, useCallback, useEffect, useLayoutEffect, useRef, type HTMLAttributes } from "react";
import { applyProps, attributes, hostProps, initialize, tag, type SkeletonProps } from "./contract";
import type { SkeletonElement } from "../../elements/skeleton";

export type ReactSkeletonProps = SkeletonProps &
  Omit<HTMLAttributes<SkeletonElement>, keyof SkeletonProps>;

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function createReactSkeleton() {
  return forwardRef<SkeletonElement, ReactSkeletonProps>(function Skeleton(props, ref) {
    const element = useRef<SkeletonElement | null>(null);
    useClientLayoutEffect(() => { if (element.current) { initialize(); applyProps(element.current, props); } });
    const attach = useCallback((node: SkeletonElement | null) => {
      element.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    }, [ref]);
    return createElement(tag(), {
      ...hostProps(props, ["className", "children"]),
      ...attributes(props), class: props.className, ref: attach,
    });
  });
}
