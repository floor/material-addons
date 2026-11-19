"use client";

import { createElement, forwardRef, useCallback, useEffect, useLayoutEffect, useRef, type HTMLAttributes } from "react";
import {
  attributes, accordionHost, defineExpansionPanel, dispatch, hostProps, listen, listenAccordion,
  panelEventKeys, panelHost, synchronizeAccordion, tag,
  type AccordionProps, type ExpansionPanelProps,
} from "./expansion-panel";
import type { AccordionElement, ExpansionPanelElement } from "../elements/expansion-panel";

export type ReactExpansionPanelProps = ExpansionPanelProps &
  Omit<HTMLAttributes<ExpansionPanelElement>, keyof ExpansionPanelProps>;
export type ReactAccordionProps = AccordionProps &
  Omit<HTMLAttributes<AccordionElement>, keyof AccordionProps | "defaultValue">;

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function createReactExpansionPanel() {
  return forwardRef<ExpansionPanelElement, ReactExpansionPanelProps>(function ExpansionPanel(props, ref) {
    const element = useRef<ExpansionPanelElement | null>(null);
    const attach = useCallback((node: ExpansionPanelElement | null) => {
      element.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    }, [ref]);
    useClientLayoutEffect(() => {
      defineExpansionPanel();
      const node = element.current;
      if (!node) return;
      return listen(node, (name, event) => dispatch(props, name, event));
    }, []);
    return createElement(tag("expansion-panel"), {
      ...hostProps(panelHost, props, [...panelEventKeys, "className", "children"]),
      ...attributes(panelHost, props), class: props.className, ref: attach,
    }, props.children);
  });
}

export function createReactAccordion() {
  return forwardRef<AccordionElement, ReactAccordionProps>(function Accordion(props, ref) {
    const element = useRef<AccordionElement | null>(null);
    const attach = useCallback((node: AccordionElement | null) => {
      element.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    }, [ref]);
    useClientLayoutEffect(() => {
      defineExpansionPanel();
      const node = element.current;
      if (!node) return;
      const stop = listenAccordion(node, (name, event) => {
        props.onChange?.(event as never);
        props.onUpdateValue?.(node.value);
      });
      synchronizeAccordion(node, props);
      return stop;
    });
    useClientLayoutEffect(() => {
      if (element.current?.component) synchronizeAccordion(element.current, props);
    });
    return createElement(tag("accordion"), {
      ...hostProps(accordionHost, props, ["onChange", "onUpdateValue", "className", "children"]),
      ...attributes(accordionHost, props), class: props.className, ref: attach,
    }, props.children);
  });
}
