import { describe, getPrefix, toAttribute, type ElementProps } from "material/elements";
import {
  defineNavigationTabs, navigationTabsElement,
  type NavigationTabsElement, type NavigationTabsElementEventMap, type NavigationTabsSpec,
} from "../../elements/navigation-tabs";

export type NavigationTabsProps = Omit<ElementProps<NavigationTabsSpec>, "defaultCurrent"> & {
  current?: string;
};
export type NavigationTabsChange = (event: NavigationTabsElementEventMap["change"]) => void;

export const navigationTabsHost = describe(navigationTabsElement.spec);
export const navigationTabsKeys = [...navigationTabsHost.attributes.keys()];
export const tag = () => `${getPrefix()}-navigation-tabs`;

export function attributes(props: NavigationTabsProps) {
  return Object.fromEntries([...navigationTabsHost.attributes].map(([key, attribute]) =>
    [attribute.name, toAttribute(attribute.type, props[key as keyof NavigationTabsProps])]));
}

export function hostProps(props: object, excluded: readonly string[]) {
  const own = new Set([...navigationTabsKeys, ...excluded]);
  return Object.fromEntries(Object.entries(props).filter(([key]) => !own.has(key)));
}

export function initialize() {
  defineNavigationTabs({ prefix: getPrefix() });
}

export function connectChange(element: NavigationTabsElement) {
  let handler: NavigationTabsChange | undefined;
  const change = (event: Event) => handler?.(event as NavigationTabsElementEventMap["change"]);
  function update(next: NavigationTabsChange | undefined) {
    if (next && !handler) element.addEventListener("change", change);
    if (!next && handler) element.removeEventListener("change", change);
    handler = next;
  }
  return { update, destroy() { update(undefined); } };
}
