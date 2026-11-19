import { defineComponent, h, onMounted, ref, type DefineSetupFnComponent } from "vue";
import { attributes, initialize, skeletonKeys, tag, type SkeletonProps } from "./contract";
import type { SkeletonElement } from "../../elements/skeleton";

export type VueSkeletonProps = SkeletonProps;

export function createVueSkeleton(): DefineSetupFnComponent<VueSkeletonProps> {
  return defineComponent<SkeletonProps>((props, { expose, slots }) => {
    const element = ref<SkeletonElement | null>(null);
    expose({ get element() { return element.value; } });
    onMounted(() => { if (element.value) initialize(); });
    return () => h(tag(), { ...attributes(props), ref: element }, slots.default?.());
  }, { name: "MSkeleton", props: [...skeletonKeys] as (keyof VueSkeletonProps)[] });
}
