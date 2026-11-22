// src/components/breadcrumb/features/withTrail.ts

import { getIcon } from "material/core/icons";
import { setHTML } from "material/core/dom";
import { BREADCRUMB_CLASSES, BREADCRUMB_ICONS } from "../constants";
import type { BreadcrumbSettings } from "../config";
import type { BreadcrumbItemState } from "../types";

export interface TrailFeature {
  element: HTMLOListElement;
  /** Every item's node, kept so the collapse can hide and restore them */
  entries: Map<string, HTMLLIElement>;
  render: (items: BreadcrumbItemState[], value: string | null, disabled: boolean) => void;
}

const glyph = (name: keyof typeof BREADCRUMB_ICONS, override?: string): string =>
  override ?? getIcon(name as Parameters<typeof getIcon>[0], BREADCRUMB_ICONS[name]);

/**
 * The trail: an ordered list of links to the ancestors, with the current page
 * as a span. Separators are decorative spans inside each item, so they are
 * not list items of their own.
 */
export const withTrail = (
  settings: BreadcrumbSettings,
  getClass: (name: string) => string,
  goTo: (value: string) => boolean,
): TrailFeature => {
  const element = document.createElement("ol");
  element.className = getClass(BREADCRUMB_CLASSES.LIST);
  const entries = new Map<string, HTMLLIElement>();
  const separatorMarkup = glyph("chevron-right", settings.separator);

  const render = (items: BreadcrumbItemState[], value: string | null, disabled: boolean): void => {
    element.replaceChildren();
    entries.clear();
    items.forEach((item, index) => {
      const row = document.createElement("li");
      row.className = getClass(BREADCRUMB_CLASSES.ITEM);
      row.dataset.value = item.value;
      if (index > 0) {
        const separator = document.createElement("span");
        separator.className = getClass(BREADCRUMB_CLASSES.SEPARATOR);
        separator.setAttribute("aria-hidden", "true");
        setHTML(separator, separatorMarkup);
        row.appendChild(separator);
      }
      const current = item.value === value && index === items.length - 1;
      if (current) {
        row.classList.add(getClass(BREADCRUMB_CLASSES.ITEM_CURRENT));
        const span = document.createElement("span");
        span.className = getClass(BREADCRUMB_CLASSES.CURRENT);
        span.setAttribute("aria-current", "page");
        span.textContent = item.label;
        row.appendChild(span);
      } else if (item.href !== undefined && !item.disabled) {
        const link = document.createElement("a");
        link.className = getClass(BREADCRUMB_CLASSES.LINK);
        link.setAttribute("href", item.href);
        link.textContent = item.label;
        link.addEventListener("click", (event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
          if (!goTo(item.value)) event.preventDefault();
        });
        row.appendChild(link);
      } else {
        const button = document.createElement("button");
        button.type = "button";
        button.className = getClass(BREADCRUMB_CLASSES.LINK);
        button.textContent = item.label;
        button.disabled = disabled || item.disabled;
        button.addEventListener("click", () => {
          if (!disabled) goTo(item.value);
        });
        row.appendChild(button);
      }
      entries.set(item.value, row);
      element.appendChild(row);
    });
  };

  return { element, entries, render };
};
