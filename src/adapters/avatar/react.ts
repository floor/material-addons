"use client";

import { createElement, forwardRef, useCallback, useEffect, useLayoutEffect, useRef, type HTMLAttributes } from "react";
import { attributes, connectClick, hostProps, initialize, tag, type AvatarClick, type AvatarProps } from "./contract";
import type { AvatarElement } from "../../elements/avatar";

export type ReactAvatarProps = AvatarProps & { onClick?: AvatarClick } &
  Omit<HTMLAttributes<AvatarElement>, keyof AvatarProps | "onClick">;

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function createReactAvatar() {
  return forwardRef<AvatarElement, ReactAvatarProps>(function Avatar(props, ref) {
    const element = useRef<AvatarElement | null>(null);
    const connection = useRef<ReturnType<typeof connectClick> | undefined>(undefined);
    useClientLayoutEffect(() => {
      if (!element.current) return;
      initialize();
      connection.current = connectClick(element.current);
      return () => connection.current?.destroy();
    }, []);
    useClientLayoutEffect(() => connection.current?.update(props.onClick));

    const attach = useCallback((node: AvatarElement | null) => {
      element.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    }, [ref]);
    return createElement(tag(), {
      ...hostProps(props, ["onClick", "className", "children"]),
      ...attributes(props), class: props.className, ref: attach,
    }, props.children);
  });
}
