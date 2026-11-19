import { defineComponent, h, onBeforeUnmount, onMounted, onUpdated, ref, type DefineSetupFnComponent, type FunctionalComponent, type HTMLAttributes } from "vue";
import {
  attributes, changesModel, initialize, initialValue, listen,
  optionHost, autocompleteHost, autocompleteKeys, synchronize, tag, type AutocompleteOptionProps, type AutocompleteProps,
} from "./contract";
import { autocompleteElementEventNames, type AutocompleteElement, type AutocompleteElementEventMap } from "../../elements/autocomplete";

export type VueAutocompleteProps = AutocompleteProps & { modelValue?: string | null };
export type VueAutocompleteEmits = {
  [K in keyof AutocompleteElementEventMap]: (event: AutocompleteElementEventMap[K]) => true;
} & {
  "update:modelValue": (value: string | null) => true;
  "update:value": (value: string | null) => true;
};

export function createVueAutocomplete(): DefineSetupFnComponent<VueAutocompleteProps, VueAutocompleteEmits> {
  const emitNames = [...autocompleteElementEventNames, "update:modelValue", "update:value"];
  const emits = Object.fromEntries(emitNames.map(name => [name, () => true])) as unknown as VueAutocompleteEmits;
  return defineComponent<VueAutocompleteProps, VueAutocompleteEmits>(
    (props: VueAutocompleteProps, { emit, expose, slots }) => {
      const element = ref<AutocompleteElement | null>(null);
      const model = () => ({ ...props, value: props.modelValue === undefined ? props.value : props.modelValue });
      expose({ get element() { return element.value; } });
      let stop: (() => void) | undefined;
      onMounted(() => {
        const node = element.value;
        if (!node) return;
        stop = listen(node, (name, event) => {
          (emit as unknown as (name: keyof AutocompleteElementEventMap, event: Event) => void)(name, event);
          if (changesModel(name)) {
            emit("update:modelValue", node.value);
            emit("update:value", node.value);
          }
        });
        initialize(node, model());
      });
      onUpdated(() => { if (element.value) synchronize(element.value, model()); });
      onBeforeUnmount(() => stop?.());
      return () => h(tag("autocomplete"), {
        ...attributes(autocompleteHost, props, true), ref: element,
        value: typeof window === "undefined" ? initialValue(model()) ?? undefined : undefined,
      }, slots.default?.());
    },
    { name: "MAutocomplete", props: [...autocompleteKeys, "modelValue"] as (keyof VueAutocompleteProps)[], emits },
  );
}

export function createVueAutocompleteOption() {
  const AutocompleteOption: FunctionalComponent<AutocompleteOptionProps & HTMLAttributes> = (props, { slots, attrs }) =>
    h(tag("autocomplete-option"), { ...attrs, ...attributes(optionHost, props) }, slots.default?.());
  AutocompleteOption.props = [...optionHost.attributes.keys()] as (keyof AutocompleteOptionProps)[];
  AutocompleteOption.displayName = "MAutocompleteOption";
  AutocompleteOption.inheritAttrs = false;
  return AutocompleteOption;
}
