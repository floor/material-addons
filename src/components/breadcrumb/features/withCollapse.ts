// src/components/breadcrumb/features/withCollapse.ts

import { getIcon } from "material/core/icons";
import { setHTML } from "material/core/dom";
import { BREADCRUMB_CLASSES, BREADCRUMB_ICONS } from "../constants";
import type { BreadcrumbSettings } from "../config";
import type { BreadcrumbItemState } from "../types";
import type { TrailFeature } from "./withTrail";

export interface CollapseFeature {
  /** The overflow list item, which stays in the trail when collapsed */
  element: HTMLLIElement;
  /** Fits the trail and rebuilds the menu; safe to call when nothing changed */
  measure: (items: BreadcrumbItemState[], value: string | null, disabled: boolean) => void;
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  destroy: () => void;
}

const glyph = (name: keyof typeof BREADCRUMB_ICONS, override?: string): string =>
  override ?? getIcon(name as Parameters<typeof getIcon>[0], BREADCRUMB_ICONS[name]);

/**
 * The overflow: a standard icon button that holds the collapsed middle items
 * in a small menu. The first item and the current page stay visible; the
 * middle collapses from the root side until the row fits.
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
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", settings.overflowLabel);
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  setHTML(icon, glyph("more-horiz"));
  button.appendChild(icon);

  const menu = document.createElement("div");
  menu.className = getClass(BREADCRUMB_CLASSES.MENU);
  menu.setAttribute("role", "menu");
  menu.tabIndex = -1;
  menu.hidden = true;
  const uid = `mtrl-breadcrumb-menu-${Math.random().toString(36).slice(2, 9)}`;
  menu.id = uid;
  button.setAttribute("aria-controls", uid);

  element.append(separator, button, menu);

  let open = false;
  let collapsed: BreadcrumbItemState[] = [];
  let outside: ((event: Event) => void) | undefined;

  const menuItems = (): HTMLElement[] =>
    Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));

  const focusFirst = (): void => {
    menuItems().find((node) => !(node as HTMLButtonElement).disabled)?.focus();
  };

  const close = (restoreFocus = true): void => {
    if (!open) return;
    open = false;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (outside) document.removeEventListener("pointerdown", outside, true);
    outside = undefined;
    if (restoreFocus) button.focus();
  };

  const show = (): void => {
    // Without an overflow button there is nothing to open
    if (open || element.parentElement !== trail.element) return;
    open = true;
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    outside = (event: Event) => {
      if (!element.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside, true);
    focusFirst();
  };

  button.addEventListener("click", () => (open ? close() : show()));
  // Tab or a click that takes focus out of the overflow closes it, as the
  // material menu does; focus follows the reader, so it is not pulled back
  element.addEventListener("focusout", (event) => {
    if (!open) return;
    const next = (event as FocusEvent).relatedTarget as Node | null;
    if (!next || !element.contains(next)) close(false);
  });
  button.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    }
  });
  menu.addEventListener("keydown", (event) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const items = menuItems().filter((node) => !(node as HTMLButtonElement).disabled);
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? (at + 1) % items.length
      : event.key === "ArrowUp" ? (at - 1 + items.length) % items.length
        : event.key === "Home" ? 0 : items.length - 1;
    items[next]!.focus();
  });

  const menuItem = (item: BreadcrumbItemState): HTMLElement => {
    const node = document.createElement(item.href !== undefined && !item.disabled ? "a" : "button");
    node.className = getClass(BREADCRUMB_CLASSES.MENU_ITEM);
    node.setAttribute("role", "menuitem");
    if (node.localName === "a") node.setAttribute("href", item.href!);
    else (node as HTMLButtonElement).type = "button";
    node.textContent = item.label;
    (node as HTMLButtonElement).disabled = item.disabled || live().disabled;
    node.addEventListener("click", (event) => {
      if (item.disabled || live().disabled) {
        event.preventDefault();
        return;
      }
      const committed = goTo(item.value);
      if (!committed && node.localName === "a") event.preventDefault();
      close();
    });
    return node;
  };

  const renderMenu = (items: BreadcrumbItemState[]): void => {
    menu.replaceChildren(...items.map(menuItem));
  };

  /** The overflow item lives inside the list, directly after the first item */
  const place = (): void => {
    element.hidden = false;
    if (element.parentElement === trail.element) return;
    const first = trail.element.children[0];
    if (first) first.after(element);
    else trail.element.prepend(element);
  };
  const remove = (): void => {
    close();
    element.remove();
  };

  const measure = (items: BreadcrumbItemState[], value: string | null, disabled: boolean): void => {
    void value;
    button.disabled = disabled;
    // Reset: every item visible, no overflow, the button out of the row
    for (const row of trail.entries.values()) row.hidden = false;
    remove();
    if (!settings.collapse || items.length <= 2) {
      collapsed = [];
      renderMenu([]);
      return;
    }
    if (typeof root.getBoundingClientRect !== "function") return;
    // The fitted check runs with the button in the row, so its width counts
    const overflow = (): boolean => trail.element.scrollWidth > root.clientWidth + 1;
    if (!overflow()) {
      collapsed = [];
      renderMenu([]);
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
    renderMenu(collapsed);
  };

  return { element, measure, open: show, close, isOpen: () => open, destroy: () => close() };
};
