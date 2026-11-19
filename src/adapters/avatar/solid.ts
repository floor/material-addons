import { createEffect, mergeProps, onCleanup, onMount, splitProps, type Component, type JSX } from "solid-js";
import { Dynamic, isServer } from "solid-js/web";
import { toAttribute } from "material/elements";
import { avatarHost, avatarKeys, connectClick, initialize, tag, type AvatarClick, type AvatarProps } from "./contract";
import type { AvatarElement } from "../../elements/avatar";

export type SolidAvatarProps = AvatarProps & { onClick?: AvatarClick; ref?: (element: AvatarElement) => void } &
  Omit<JSX.HTMLAttributes<AvatarElement>, keyof AvatarProps | "onClick" | "ref">;

export function createSolidAvatar(): Component<SolidAvatarProps> {
  return props => {
    const [, rest] = splitProps(props, [...avatarKeys, "onClick", "ref"] as (keyof SolidAvatarProps)[]);
    let element: AvatarElement | undefined;
    onMount(() => {
      if (!element) return;
      initialize();
      const connection = connectClick(element);
      createEffect(() => connection.update(props.onClick));
      onCleanup(connection.destroy);
    });
    const mapped: Record<string, unknown> = {};
    for (const [key, attribute] of avatarHost.attributes) {
      Object.defineProperty(mapped, isServer ? attribute.name : `attr:${attribute.name}`, {
        enumerable: true, get() {
          const value = toAttribute(attribute.type, props[key as keyof AvatarProps]);
          return attribute.type === "boolean" && value !== undefined ? true : value;
        },
      });
    }
    return Dynamic(mergeProps(rest, mapped, {
      component: tag(),
      ref(node: AvatarElement) { element = node; props.ref?.(node); },
    }) as never);
  };
}
