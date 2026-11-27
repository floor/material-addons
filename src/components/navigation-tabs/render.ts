import { NAVIGATION_TABS_CLASSES as classes } from "./constants";
import type { NavigationTab, NavigationTabsOptions } from "./types";

const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escape = (value: string): string => value.replace(/[&<>"]/g, character => entities[character]!);

/** Renders native navigation links on the server. The current page is the first marked link. */
export function renderNavigationTabs(
  label: string,
  tabs: readonly NavigationTab[],
  { sticky = false }: NavigationTabsOptions = {},
): string {
  const current = tabs.findIndex(tab => tab.current);
  const items = tabs.map((tab, index) => {
    const active = index === current ? ' aria-current="page"' : "";
    return `<a class="${classes.TAB}" href="${escape(tab.href)}"${active}>`
      + `<span class="${classes.INDICATOR}" aria-hidden="true"></span>`
      + (tab.icon ? `<span class="${classes.ICON}" aria-hidden="true">${tab.icon}</span>` : "")
      + `<span class="${classes.LABEL}">${escape(tab.label)}</span></a>`;
  }).join("");
  const rootClass = sticky ? `${classes.ROOT} ${classes.STICKY}` : classes.ROOT;
  return `<nav class="${rootClass}" aria-label="${escape(label)}">${items}</nav>`;
}
