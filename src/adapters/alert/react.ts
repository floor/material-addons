"use client";

import { createElement, forwardRef, useCallback, useEffect, useLayoutEffect, useRef, type HTMLAttributes } from "react";
import {
  attributes,
  dispatch,
  eventKeys,
  hostProps,
  initialize,
  listen,
  synchronize,
  tag,
  type AlertEventProps,
  type AlertProps,
} from "./contract";
import type { AlertElement } from "../../elements/alert";

export type ReactAlertProps = AlertProps & AlertEventProps &
  Omit<HTMLAttributes<AlertElement>, keyof (AlertProps & AlertEventProps)>;

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function createReactAlert() {
  return forwardRef<AlertElement, ReactAlertProps>(function Alert(props, ref) {
    const element = useRef<AlertElement | null>(null);
    const latestProps = useRef(props);
    latestProps.current = props;

    useClientLayoutEffect(() => {
      const node = element.current;
      if (!node) return;
      initialize(node, latestProps.current);
      return listen(node, (name, event) => dispatch(latestProps.current, name, event));
    }, []);

    useClientLayoutEffect(() => {
      if (element.current?.component) synchronize(element.current, props);
    });

    const attach = useCallback((node: AlertElement | null) => {
      element.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    }, [ref]);

    return createElement(tag(), {
      ...hostProps(props, [...eventKeys, "className", "children"]),
      ...attributes(props),
      class: props.className,
      ref: attach,
    }, props.children);
  });
}
