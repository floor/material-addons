import { defineComponent, h, onBeforeUnmount, onMounted, onUpdated, ref, type DefineSetupFnComponent } from "vue";
import { attributes, navigationTabsKeys, connectChange, initialize, tag, type NavigationTabsChange, type NavigationTabsProps } from "./contract";
import type { NavigationTabsElement } from "../../elements/navigation-tabs";

export type VueNavigationTabsProps = NavigationTabsProps & { onChange?: NavigationTabsChange };

export function createVueNavigationTabs(): DefineSetupFnComponent<VueNavigationTabsProps> {
  return defineComponent<VueNavigationTabsProps>((props, { expose, slots }) => {
    const element = ref<NavigationTabsElement | null>(null);
    let connection: ReturnType<typeof connectChange> | undefined;
    expose({ get element() { return element.value; } });
    onMounted(() => {
      if (!element.value) return;
      initialize();
      connection = connectChange(element.value);
      connection.update(props.onChange);
    });
    onUpdated(() => connection?.update(props.onChange));
    onBeforeUnmount(() => connection?.destroy());
    return () => h(tag(), { ...attributes(props), ref: element }, slots.default?.());
  }, { name: "MNavigationTabs", props: [...navigationTabsKeys, "onChange"] as (keyof VueNavigationTabsProps)[] });
}
