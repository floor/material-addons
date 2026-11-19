import { defineComponent, h, onBeforeUnmount, onMounted, onUpdated, ref, type DefineSetupFnComponent } from "vue";
import { attributes, avatarKeys, connectClick, initialize, tag, type AvatarClick, type AvatarProps } from "./contract";
import type { AvatarElement } from "../../elements/avatar";

export type VueAvatarProps = AvatarProps & { onClick?: AvatarClick };

export function createVueAvatar(): DefineSetupFnComponent<VueAvatarProps> {
  return defineComponent<VueAvatarProps>((props, { expose, slots }) => {
    const element = ref<AvatarElement | null>(null);
    let connection: ReturnType<typeof connectClick> | undefined;
    expose({ get element() { return element.value; } });
    onMounted(() => {
      if (!element.value) return;
      initialize();
      connection = connectClick(element.value);
      connection.update(props.onClick);
    });
    onUpdated(() => connection?.update(props.onClick));
    onBeforeUnmount(() => connection?.destroy());
    return () => h(tag(), { ...attributes(props), ref: element }, slots.default?.());
  }, { name: "MAvatar", props: [...avatarKeys, "onClick"] as (keyof VueAvatarProps)[] });
}
