// src/components/breadcrumb/features/withCollapse.ts

import { getIcon } from "material/core/icons";
import { setHTML } from "material/core/dom";
import { createMenu } from "material/components/menu";
import { BREADCRUMB_CLASSES, BREADCRUMB_ICONS } from "../constants";
import type { BreadcrumbSettings } from "../config";
import type { BreadcrumbItemState } from "../types";
import type { TrailFeature } from "./withTrail";

export interface CollapseFeature {
  /** The overflow list item, inside the trail while items are collapsed */
  element: HTMLLIElement;
  /** Fits the trail and rebuilds the menu's items */
  measure: (items: BreadcrumbItemState[], value: string | null, disabled: boolean) => void;
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  destroy: () => void;
}

const glyph = (name: keyof typeof BREADCRUMB_ICONS, override?: string): string =>
  override ?? getIcon(name as Parameters<typeof getIcon>[0], BREADCRUMB_ICONS[name]);

/**
 * The overflow: a standard icon button that opens material's menu in the top
 * layer, so nothing clips the popup and its own keyboard (roving arrows,
 * Home and End, Tab closing it) and dismissal apply. The first item and the
 * current page stay visible; the middle collapses from the root side until
 * the row fits, and the button's own width counts in that check.
 */
export const withCollapse = (
  settings: BreadcrumbSettings,
  getClass: (name: string) => string,
  root: HTMLElement,
  trail: TrailFeature,
  goTo: (value: string) => boolean,
  live: () => { value: string | null; disabled: boolean },
): CollapseFeature => {
  const element = document.createElement("li");
  element.className = `${getClass(BREADCRUMB_CLASSES.ITEM)} ${getClass(BREADCRUMB_CLASSES.ITEM_OVERFLOW)}`;
  element.hidden = true;
  const separator = document.createElement("span");
  separator.className = getClass(BREADCRUMB_CLASSES.SEPARATOR);
  separator.setAttribute("aria-hidden", "true");
  setHTML(separator, glyph("chevron-right", settings.separator));

  const button = document.createElement("button");
  button.type = "button";
  button.className = getClass(BREADCRUMB_CLASSES.OVERFLOW);
  button.setAttribute("aria-label", settings.overflowLabel);
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  setHTML(icon, glyph("more-horiz"));
  button.appendChild(icon);
  element.append(separator, button);

  let collapsed: BreadcrumbItemState[] = [];
  const itemFor = (id: string): BreadcrumbItemState | undefined => collapsed.find((item) => item.value === id);

  // The menu is built the first time something is collapsed: a trail that
  // fits needs no menu at all. It lives in the top layer beside its opener,
  // so the list's own 48px row never clips it.
  let menu: ReturnType<typeof createMenu> | undefined;
  const menuOf = (): ReturnType<typeof createMenu> => {
    menu ??= createMenu({
      opener: button,
      items: [],
      layer: "top",
      position: "bottom-start",
      closeOnClickOutside: true,
      closeOnEscape: true,
      on: {
        select: (event) => {
          const item = itemFor(event.itemId);
          if (!item) return;
          if (item.disabled || live().disabled) return;
          const committed = goTo(item.value);
          // A collapsed item is a destination: it navigates like the link it
          // stands for, unless the move was vetoed
          if (committed && item.href !== undefined) window.location.assign(item.href);
        },
      },
    });
    return menu;
  };

  const place = (): void => {
    element.hidden = false;
    if (element.parentElement === trail.element) return;
    const first = trail.element.children[0];
    if (first) first.after(element);
    else trail.element.prepend(element);
  };

  const measure = (items: BreadcrumbItemState[], value: string | null, disabled: boolean): void => {
    void value;
    button.disabled = disabled;
    // Reset: every item visible, no overflow, the button out of the row
    for (const row of trail.entries.values()) row.hidden = false;
    menu?.close();
    element.remove();
    if (!settings.collapse || items.length <= 2) {
      collapsed = [];
      menu?.setItems([]);
      return;
    }
    if (typeof root.getBoundingClientRect !== "function") return;
    // The fit check runs with the button in the row, so its width counts
    const overflow = (): boolean => trail.element.scrollWidth > root.clientWidth + 1;
    if (!overflow()) {
      collapsed = [];
      menu?.setItems([]);
      return;
    }
    // Collapse from the root side until the row fits, keeping first and last
    const middle = items.slice(1, -1);
    const hidden: BreadcrumbItemState[] = [];
    place();
    for (const item of middle) {
      const row = trail.entries.get(item.value);
      if (!row) continue;
      row.hidden = true;
      hidden.push(item);
      if (!overflow()) break;
    }
    // If hiding every middle item still overflows, the row scrolls
    collapsed = hidden;
    menuOf().setItems(collapsed.map((item) => ({
      id: item.value,
      text: item.label,
      disabled: item.disabled || disabled,
    })));
  };

  return {
    element,
    measure,
    open: () => {
      if (element.parentElement === trail.element) menuOf().open();
    },
    close: () => menu?.close(),
    isOpen: () => menu?.isOpen() ?? false,
    destroy: () => {
      menu?.close();
      menu?.destroy();
    },
  };
};
