import { defineComponent, h, onBeforeUnmount, onMounted, ref, type DefineSetupFnComponent, type FunctionalComponent, type HTMLAttributes } from "vue";
import {
  accordionHost, attributes, defineExpansionPanel, dispatch, expansionPanelEventNames, listen,
  listenAccordion, panelHost, synchronizeAccordion, tag, type AccordionProps, type ExpansionPanelProps,
} from "./expansion-panel";
import type { AccordionElement, ExpansionPanelElement, ExpansionPanelElementEventMap } from "../elements/expansion-panel";

export type VueExpansionPanelProps = ExpansionPanelProps;
export type VueExpansionPanelEmits = {
  [K in keyof ExpansionPanelElementEventMap]: (event: ExpansionPanelElementEventMap[K]) => true;
};
export type VueAccordionProps = AccordionProps;
export type VueAccordionEmits = { change: (event: Event) => true; "update:modelValue": (value: string | null) => true };

export function createVueExpansionPanel(): DefineSetupFnComponent<VueExpansionPanelProps, VueExpansionPanelEmits> {
  const emits = Object.fromEntries(expansionPanelEventNames.map((name) => [name, () => true])) as unknown as VueExpansionPanelEmits;
  return defineComponent<VueExpansionPanelProps, VueExpansionPanelEmits>(
    (props, { emit, slots }) => {
      const element = ref<ExpansionPanelElement | null>(null);
      let stop: (() => void) | undefined;
      onMounted(() => {
        defineExpansionPanel();
        const node = element.value;
        if (!node) return;
        stop = listen(node, (name, event) => {
          (emit as unknown as (name: string, event: Event) => void)(name, event);
          dispatch(props, name, event);
        });
      });
      onBeforeUnmount(() => stop?.());
      return () => h(tag("expansion-panel"), { ...attributes(panelHost, props), ref: element }, slots.default?.());
    },
    { name: "MExpansionPanel", emits },
  );
}

export function createVueAccordion(): DefineSetupFnComponent<VueAccordionProps, VueAccordionEmits> {
  return defineComponent<VueAccordionProps, VueAccordionEmits>(
    (props, { emit, slots }) => {
      const element = ref<AccordionElement | null>(null);
      let stop: (() => void) | undefined;
      onMounted(() => {
        defineExpansionPanel();
        const node = element.value;
        if (!node) return;
        stop = listenAccordion(node, (_name, event) => {
          emit("change", event);
          emit("update:modelValue", node.value);
        });
        synchronizeAccordion(node, props as AccordionProps);
      });
      onBeforeUnmount(() => stop?.());
      return () => h(tag("accordion"), { ...attributes(accordionHost, props), ref: element }, slots.default?.());
    },
    { name: "MAccordion", emits: { change: () => true, "update:modelValue": () => true } },
  );
}
