import { createEffect, mergeProps, onCleanup, onMount, splitProps, type Component, type JSX } from "solid-js";
import { Dynamic, isServer } from "solid-js/web";
import { toAttribute } from "material/elements";
import { navigationTabsHost, navigationTabsKeys, connectChange, initialize, tag, type NavigationTabsChange, type NavigationTabsProps } from "./contract";
import type { NavigationTabsElement } from "../../elements/navigation-tabs";

export type SolidNavigationTabsProps = NavigationTabsProps & { onChange?: NavigationTabsChange; ref?: (element: NavigationTabsElement) => void } &
  Omit<JSX.HTMLAttributes<NavigationTabsElement>, keyof NavigationTabsProps | "onChange" | "ref">;

export function createSolidNavigationTabs(): Component<SolidNavigationTabsProps> {
  return props => {
    const [, rest] = splitProps(props, [...navigationTabsKeys, "onChange", "ref"] as (keyof SolidNavigationTabsProps)[]);
    let element: NavigationTabsElement | undefined;
    onMount(() => {
      if (!element) return;
      initialize();
      const connection = connectChange(element);
      createEffect(() => connection.update(props.onChange));
      onCleanup(connection.destroy);
    });
    const mapped: Record<string, unknown> = {};
    for (const [key, attribute] of navigationTabsHost.attributes) {
      Object.defineProperty(mapped, isServer ? attribute.name : `attr:${attribute.name}`, {
        enumerable: true, get() {
          const value = toAttribute(attribute.type, props[key as keyof NavigationTabsProps]);
          return attribute.type === "boolean" && value !== undefined ? true : value;
        },
      });
    }
    return Dynamic(mergeProps(rest, mapped, {
      component: tag(),
      ref(node: NavigationTabsElement) { element = node; props.ref?.(node); },
    }) as never);
  };
}
