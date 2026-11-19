import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import {
  defineExpansionPanel, listen, listenAccordion, sveltePanelEventKeys, synchronizeAccordion,
  type AccordionProps, type ExpansionPanelProps,
} from "./expansion-panel";
import type { AccordionElement, ExpansionPanelElement, ExpansionPanelElementEventMap } from "../elements/expansion-panel";

export { attributes, defineExpansionPanel, hostProps, panelHost, accordionHost, sveltePanelEventKeys, tag } from "./expansion-panel";

export type SvelteExpansionPanelEvents = {
  [K in keyof ExpansionPanelElementEventMap as `on${K}`]?: (event: ExpansionPanelElementEventMap[K]) => void;
};
export type SvelteExpansionPanelProps = ExpansionPanelProps & SvelteExpansionPanelEvents &
  Omit<HTMLAttributes<HTMLElement>, keyof (ExpansionPanelProps & SvelteExpansionPanelEvents) | "children"> & { children?: Snippet };
export type SvelteAccordionProps = AccordionProps & { children?: Snippet };

interface PanelBinding {
  props: SvelteExpansionPanelProps;
}

export function connectExpansionPanel(node: ExpansionPanelElement, initial: PanelBinding) {
  defineExpansionPanel();
  let binding = initial;
  const destroy = listen(node, (name, event) => {
    binding.props[`on${name}` as keyof SvelteExpansionPanelEvents]?.(event as never);
  });
  return {
    update(next: PanelBinding) {
      binding = next;
    },
    destroy,
  };
}

interface AccordionBinding {
  props: SvelteAccordionProps;
  set(value: string | null): void;
}

export function connectAccordion(node: AccordionElement, initial: AccordionBinding) {
  defineExpansionPanel();
  let binding = initial;
  const destroy = listenAccordion(node, () => binding.set(node.value));
  synchronizeAccordion(node, initial.props);
  return {
    update(next: AccordionBinding) {
      binding = next;
      synchronizeAccordion(node, next.props);
    },
    destroy,
  };
}
