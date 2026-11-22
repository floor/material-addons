import { defineComponent, h, onBeforeUnmount, onMounted, onUpdated, ref, type DefineSetupFnComponent } from "vue";
import {
  attributes, changesModel, initialize, initialValue, listen, ratingKeys, synchronize, tag, type RatingProps,
} from "./contract";
import { ratingElementEventNames, type RatingElement, type RatingElementEventMap } from "../../elements/rating";

export type VueRatingProps = RatingProps & { modelValue?: number };
export type VueRatingEmits = {
  [K in keyof RatingElementEventMap]: (event: RatingElementEventMap[K]) => true;
} & {
  "update:modelValue": (value: number) => true;
  "update:value": (value: number) => true;
};

export function createVueRating(): DefineSetupFnComponent<VueRatingProps, VueRatingEmits> {
  const emitNames = [...ratingElementEventNames, "update:modelValue", "update:value"];
  const emits = Object.fromEntries(emitNames.map(name => [name, () => true])) as unknown as VueRatingEmits;
  return defineComponent<VueRatingProps, VueRatingEmits>(
    (props: VueRatingProps, { emit, expose, slots }) => {
      const element = ref<RatingElement | null>(null);
      const model = () => ({ ...props, value: props.modelValue === undefined ? props.value : props.modelValue });
      expose({ get element() { return element.value; } });
      let stop: (() => void) | undefined;
      onMounted(() => {
        const node = element.value;
        if (!node) return;
        stop = listen(node, (name, event) => {
          (emit as unknown as (name: keyof RatingElementEventMap, event: Event) => void)(name, event);
          if (changesModel(name)) {
            emit("update:modelValue", node.value);
            emit("update:value", node.value);
          }
        });
        initialize(node, model());
      });
      onUpdated(() => { if (element.value) synchronize(element.value, model()); });
      onBeforeUnmount(() => stop?.());
      return () => h(tag(), {
        ...attributes(props, true), ref: element,
        value: typeof window === "undefined" ? initialValue(model()) : undefined,
      }, slots.default?.());
    },
    { name: "MRating", props: [...ratingKeys, "modelValue"] as (keyof VueRatingProps)[], emits },
  );
}
