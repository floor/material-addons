"use client";

import { createElement, forwardRef, useCallback, useEffect, useLayoutEffect, useRef, type ForwardRefExoticComponent, type HTMLAttributes, type RefAttributes } from "react";
import {
  attributes, changesModel, dispatch, eventKeys, hostProps, initialize, initialValue,
  listen, stepHost, stepperHost, synchronize, tag,
  type StepProps, type StepperEventProps, type StepperProps,
} from "./stepper";
import type { StepperElement } from "../elements/stepper";
import {
  attributes as skeletonAttributes, initialize as initializeSkeleton,
  passthrough as skeletonPassthrough,
  synchronize as synchronizeSkeleton, tag as skeletonTag,
  type SkeletonProps,
} from "./skeleton";
import type { SkeletonElement } from "../elements/skeleton";

export type ReactStepperProps = StepperProps & StepperEventProps &
  Omit<HTMLAttributes<StepperElement>, keyof StepperProps | keyof StepperEventProps | "defaultValue">;
export type ReactStepProps = StepProps & Omit<HTMLAttributes<HTMLElement>, keyof StepProps>;

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function createReactStepper() {
  const Stepper = forwardRef<StepperElement, ReactStepperProps>(function Stepper(props, ref) {
    const element = useRef<StepperElement | null>(null);
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
    const attach = useCallback((node: StepperElement | null) => {
      element.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    }, [ref]);
    const passthrough = hostProps(stepperHost, props, [...eventKeys, "defaultValue", "className", "children"]);
    return createElement(tag("stepper"), {
      ...passthrough, ...attributes(stepperHost, props, true), class: props.className,
      value: typeof window === "undefined" ? initialValue(props) ?? undefined : undefined,
      ref: attach,
    }, props.children);
  });
  return Stepper;
}

export function createReactStep() {
  return forwardRef<HTMLElement, ReactStepProps>(function Step(props, ref) {
    return createElement(tag("step"), {
      ...hostProps(stepHost, props, ["className", "children"]),
      ...attributes(stepHost, props), class: props.className, ref,
    }, props.children);
  });
}

export type ReactSkeletonProps = SkeletonProps &
  Omit<HTMLAttributes<SkeletonElement>, keyof SkeletonProps>;

/** `<m-skeleton>` for React: attributes in, no events, no model. */
export function createReactSkeleton(): ForwardRefExoticComponent<ReactSkeletonProps & RefAttributes<SkeletonElement>> {
  const Skeleton = forwardRef<SkeletonElement, ReactSkeletonProps>(function Skeleton(props, ref) {
    const element = useRef<SkeletonElement | null>(null);
    useClientLayoutEffect(() => {
      const node = element.current;
      if (node) {
        initializeSkeleton(node, props);
        synchronizeSkeleton(node, props);
      }
    });
    return createElement(skeletonTag(), {
      ...skeletonPassthrough(props as Record<string, unknown>),
      ...skeletonAttributes(props),
      class: props.className,
      ref,
    });
  });
  return Skeleton;
}
