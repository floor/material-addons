// src/adapters/vue-breadcrumb.ts

import { defineComponent, h, onBeforeUnmount, onMounted, onUpdated, ref, type DefineSetupFnComponent } from "vue";
import {
  attributes, breadcrumbEventNames, breadcrumbKeys, defineBreadcrumb, hostProps, listenBreadcrumb,
  synchronizeBreadcrumb, tag, type BreadcrumbElementEventMap, type BreadcrumbProps,
} from "./breadcrumb";
import type { BreadcrumbElement } from "../elements/breadcrumb";

export type VueBreadcrumbProps = BreadcrumbProps;
export type VueBreadcrumbEmits = {
  [K in keyof BreadcrumbElementEventMap]: (event: BreadcrumbElementEventMap[K]) => true;
};

export function createVueBreadcrumb(): DefineSetupFnComponent<VueBreadcrumbProps, VueBreadcrumbEmits> {
  const emits = Object.fromEntries(breadcrumbEventNames.map((name) => [name, () => true])) as unknown as VueBreadcrumbEmits;
  return defineComponent<VueBreadcrumbProps, VueBreadcrumbEmits>(
    (props, { emit, slots }) => {
      const element = ref<BreadcrumbElement | null>(null);
      let stop: (() => void) | undefined;
      onMounted(() => {
        defineBreadcrumb();
        const node = element.value;
        if (!node) return;
        stop = listenBreadcrumb(node, (name, event) => {
          (emit as unknown as (name: string, event: Event) => void)(name, event);
        });
        synchronizeBreadcrumb(node, props);
      });
      onUpdated(() => {
        const node = element.value;
        if (node?.component) synchronizeBreadcrumb(node, props);
      });
      onBeforeUnmount(() => stop?.());
      return () => h(tag(), {
        ...hostProps(props, ["onBeforechange", "onChange"]),
        ...attributes(props),
        ref: element,
      }, slots.default?.());
    },
    { name: "MBreadcrumb", props: [...breadcrumbKeys] as (keyof VueBreadcrumbProps)[], emits },
  );
}
