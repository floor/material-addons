import { mergeProps, onCleanup, onMount, splitProps, type Component, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import {
  accordionHost, attributes, defineExpansionPanel, dispatch, hostProps, listen, listenAccordion,
  panelEventKeys, panelHost, synchronizeAccordion, tag,
  type AccordionProps, type ExpansionPanelProps,
} from "./expansion-panel";
import type { AccordionElement, ExpansionPanelElement } from "../elements/expansion-panel";

type Host<E extends HTMLElement> = JSX.HTMLAttributes<E> & { children?: JSX.Element };
export type SolidExpansionPanelProps = ExpansionPanelProps & Omit<Host<ExpansionPanelElement>, keyof ExpansionPanelProps | "ref"> & { ref?: (node: ExpansionPanelElement) => void };
export type SolidAccordionProps = AccordionProps & Omit<Host<AccordionElement>, keyof AccordionProps | "ref"> & { ref?: (node: AccordionElement) => void };

export function createSolidExpansionPanel(): Component<SolidExpansionPanelProps> {
  return (props) => {
    let element: ExpansionPanelElement | undefined;
    onMount(() => {
      defineExpansionPanel();
      const node = element;
      if (!node) return;
      onCleanup(listen(node, (name, event) => dispatch(props, name, event)));
    });
    const [rest] = splitProps(props, [...panelEventKeys, "ref"] as (keyof SolidExpansionPanelProps)[]);
    return Dynamic(mergeProps(rest, hostProps(panelHost, props, [...panelEventKeys, "ref"]), attributes(panelHost, props), {
      component: tag("expansion-panel"),
      ref(node: ExpansionPanelElement) { element = node; props.ref?.(node); },
    }) as never);
  };
}

export function createSolidAccordion(): Component<SolidAccordionProps> {
  return (props) => {
    let element: AccordionElement | undefined;
    onMount(() => {
      defineExpansionPanel();
      const node = element;
      if (!node) return;
      onCleanup(listenAccordion(node, () => {
        props.onChange?.({ value: node.value, values: node.component?.getValues() ?? [], open: true } as never);
        props.onUpdateValue?.(node.value);
      }));
      synchronizeAccordion(node, props);
    });
    const [rest] = splitProps(props, ["onChange", "onUpdateValue", "ref"] as (keyof SolidAccordionProps)[]);
    return Dynamic(mergeProps(rest, hostProps(accordionHost, props, ["ref"]), attributes(accordionHost, props), {
      component: tag("accordion"),
      ref(node: AccordionElement) { element = node; props.ref?.(node); },
    }) as never);
  };
}
