import { defineComponent, h, onBeforeUnmount, onMounted, onUpdated, ref, type DefineSetupFnComponent } from "vue";
import {
  alertElementEventNames,
  alertKeys,
  attributes,
  dispatch,
  eventKeys,
  initialize,
  listen,
  synchronize,
  tag,
  type AlertEventProps,
  type AlertProps,
} from "./contract";
import type { AlertElement, AlertElementEventMap } from "../../elements/alert";

export type VueAlertProps = AlertProps & AlertEventProps;
export type VueAlertEmits = {
  [K in keyof AlertElementEventMap]: (event: AlertElementEventMap[K]) => true;
};

export function createVueAlert(): DefineSetupFnComponent<VueAlertProps, VueAlertEmits> {
  const emits = Object.fromEntries(alertElementEventNames.map(name => [name, () => true])) as unknown as VueAlertEmits;
  return defineComponent<VueAlertProps, VueAlertEmits>(
    (props, { emit, expose, slots }) => {
      const element = ref<AlertElement | null>(null);
      let stop: (() => void) | undefined;
      expose({ get element() { return element.value; } });
      onMounted(() => {
        const node = element.value;
        if (!node) return;
        initialize(node, props);
        stop = listen(node, (name, event) => {
          (emit as unknown as (name: string, event: Event) => void)(name, event);
        });
      });
      onUpdated(() => {
        if (element.value) synchronize(element.value, props);
      });
      onBeforeUnmount(() => stop?.());
      return () => h(tag(), { ...attributes(props), ref: element }, slots.default?.());
    },
    { name: "MAlert", props: [...alertKeys] as (keyof VueAlertProps)[], emits },
  );
}
