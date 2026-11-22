// src/adapters/vue-paginator.ts

import { defineComponent, h, onBeforeUnmount, onMounted, onUpdated, ref, type DefineSetupFnComponent, type HTMLAttributes } from "vue";
import {
  attributes, definePaginator, hostProps, listenPaginator, paginatorEventNames, paginatorKeys,
  synchronizePaginator, tag, type PaginatorElementEventMap, type PaginatorProps,
} from "./paginator";
import type { PaginatorElement } from "../elements/paginator";

export type VuePaginatorProps = PaginatorProps;
export type VuePaginatorEmits = {
  change: (event: PaginatorElementEventMap["change"]) => true;
};

export function createVuePaginator(): DefineSetupFnComponent<VuePaginatorProps, VuePaginatorEmits> {
  const emits = Object.fromEntries(paginatorEventNames.map((name) => [name, () => true])) as unknown as VuePaginatorEmits;
  return defineComponent<VuePaginatorProps, VuePaginatorEmits>(
    (props, { emit }) => {
      const element = ref<PaginatorElement | null>(null);
      let stop: (() => void) | undefined;
      onMounted(() => {
        definePaginator();
        const node = element.value;
        if (!node) return;
        stop = listenPaginator(node, (event) => {
          (emit as unknown as (name: string, event: Event) => void)("change", event);
          props.onChange?.(event as never);
        });
        synchronizePaginator(node, props);
      });
      onUpdated(() => {
        const node = element.value;
        if (node?.component) synchronizePaginator(node, props);
      });
      onBeforeUnmount(() => stop?.());
      return () => h(tag(), {
        ...hostProps(props, ["onChange"]),
        ...attributes(props),
        ref: element,
      });
    },
    { name: "MPaginator", props: [...paginatorKeys] as (keyof VuePaginatorProps)[], emits },
  );
}
