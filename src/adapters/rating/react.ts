"use client";

import { createElement, forwardRef, useCallback, useEffect, useLayoutEffect, useRef, type HTMLAttributes } from "react";
import {
  attributes, changesModel, dispatch, eventKeys, hostProps, initialize, initialValue,
  listen, ratingHost, synchronize, tag, type RatingEventProps, type RatingProps,
} from "./contract";
import type { RatingElement } from "../../elements/rating";

export type ReactRatingProps = RatingProps & RatingEventProps &
  Omit<HTMLAttributes<RatingElement>, keyof RatingProps | keyof RatingEventProps | "defaultValue">;

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function createReactRating() {
  const Rating = forwardRef<RatingElement, ReactRatingProps>(function Rating(props, ref) {
    const element = useRef<RatingElement | null>(null);
    const latest = useRef(props);
    useClientLayoutEffect(() => {
      latest.current = props;
      if (element.current?.component) synchronize(element.current, props);
    });
    useClientLayoutEffect(() => {
      const node = element.current;
      if (!node) return;
      const stop = listen(node, (name, event) => {
        dispatch(latest.current, name, event);
        if (changesModel(name)) queueMicrotask(() => {
          if (element.current === node && node.isConnected) synchronize(node, latest.current);
        });
      });
      initialize(node, latest.current);
      return stop;
    }, []);
    const attach = useCallback((node: RatingElement | null) => {
      element.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    }, [ref]);
    const passthrough = hostProps(props, [...eventKeys, "defaultValue", "className", "children"]);
    return createElement(tag(), {
      ...passthrough, ...attributes(props, true), class: props.className,
      value: typeof window === "undefined" ? initialValue(props) : undefined,
      ref: attach,
    }, props.children);
  });
  return Rating;
}
