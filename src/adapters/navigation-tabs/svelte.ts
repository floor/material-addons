import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import { connectChange, initialize, type NavigationTabsChange, type NavigationTabsProps } from "./contract";
import type { NavigationTabsElement } from "../../elements/navigation-tabs";

export { attributes, hostProps, tag } from "./contract";
export type SvelteNavigationTabsProps = NavigationTabsProps & { onchange?: NavigationTabsChange; children?: Snippet } &
  Omit<HTMLAttributes<HTMLElement>, keyof NavigationTabsProps | "onchange" | "children">;

export function connectNavigationTabs(node: NavigationTabsElement, handler: NavigationTabsChange | undefined) {
  initialize();
  const connection = connectChange(node);
  connection.update(handler);
  return connection;
}
