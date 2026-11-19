import { defineComponent, h, onBeforeUnmount, onMounted, onUpdated, ref, type DefineSetupFnComponent, type FunctionalComponent, type HTMLAttributes } from "vue";
import {
  attributes, changesModel, initialize, initialValue, listen,
  stepHost, stepperHost, stepperKeys, synchronize, tag, type StepProps, type StepperProps,
} from "./stepper";
import { stepperElementEventNames, type StepperElement, type StepperElementEventMap } from "../elements/stepper";
import {
  attributes as skeletonAttributes, initialize as initializeSkeleton, skeletonHost,
  synchronize as synchronizeSkeleton, tag as skeletonTag, type SkeletonProps,
} from "./skeleton";
import type { SkeletonElement } from "../elements/skeleton";

export type VueStepperProps = StepperProps & { modelValue?: string | null };
export type VueStepperEmits = {
  [K in keyof StepperElementEventMap]: (event: StepperElementEventMap[K]) => true;
} & {
  "update:modelValue": (value: string | null) => true;
  "update:value": (value: string | null) => true;
};

export function createVueStepper(): DefineSetupFnComponent<VueStepperProps, VueStepperEmits> {
  const emitNames = [...stepperElementEventNames, "update:modelValue", "update:value"];
  const emits = Object.fromEntries(emitNames.map(name => [name, () => true])) as unknown as VueStepperEmits;
  return defineComponent<VueStepperProps, VueStepperEmits>(
    (props: VueStepperProps, { emit, expose, slots }) => {
      const element = ref<StepperElement | null>(null);
      const model = () => ({ ...props, value: props.modelValue === undefined ? props.value : props.modelValue });
      expose({ get element() { return element.value; } });
      let stop: (() => void) | undefined;
      onMounted(() => {
        const node = element.value;
        if (!node) return;
        stop = listen(node, (name, event) => {
          (emit as unknown as (name: keyof StepperElementEventMap, event: Event) => void)(name, event);
          if (changesModel(name)) {
            emit("update:modelValue", node.value);
            emit("update:value", node.value);
          }
        });
        initialize(node, model());
      });
      onUpdated(() => { if (element.value) synchronize(element.value, model()); });
      onBeforeUnmount(() => stop?.());
      return () => h(tag("stepper"), {
        ...attributes(stepperHost, props, true), ref: element,
        value: typeof window === "undefined" ? initialValue(model()) ?? undefined : undefined,
      }, slots.default?.());
    },
    { name: "MStepper", props: [...stepperKeys, "modelValue"] as (keyof VueStepperProps)[], emits },
  );
}

export function createVueStep() {
  const Step: FunctionalComponent<StepProps & HTMLAttributes> = (props, { slots, attrs }) =>
    h(tag("step"), { ...attrs, ...attributes(stepHost, props) }, slots.default?.());
  Step.props = [...stepHost.attributes.keys()] as (keyof StepProps)[];
  Step.displayName = "MStep";
  Step.inheritAttrs = false;
  return Step;
}

export type VueSkeletonProps = SkeletonProps;

/** `<m-skeleton>` for Vue: attributes in, no events, no model. */
export function createVueSkeleton(): DefineSetupFnComponent<VueSkeletonProps> {
  return defineComponent(
    (props: VueSkeletonProps) => {
      const element = ref<SkeletonElement | null>(null);
      onMounted(() => { if (element.value) initializeSkeleton(element.value, props); });
      onUpdated(() => { if (element.value) synchronizeSkeleton(element.value, props); });
      return () => h(skeletonTag(), { ...skeletonAttributes(props), ref: element });
    },
    { name: "MSkeleton", props: [...skeletonHost.attributes.keys()] as (keyof VueSkeletonProps)[] },
  );
}
