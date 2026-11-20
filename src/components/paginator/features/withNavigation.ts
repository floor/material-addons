// src/components/paginator/features/withNavigation.ts

import { getIcon } from "material/core/icons";
import { setHTML } from "material/core/dom";
import { PAGINATOR_CLASSES, PAGINATOR_ICONS } from "../constants";
import type { PaginatorSettings } from "../config";

export interface NavigationFeature {
  element: HTMLElement;
  pages: HTMLElement;
  buttons: {
    first: HTMLButtonElement;
    prev: HTMLButtonElement;
    next: HTMLButtonElement;
    last: HTMLButtonElement;
  };
  /** Draws the disabled states for the current page and page count */
  sync: (page: number, pageCount: number, disabled: boolean, ends: boolean) => void;
}

/**
 * The paginator's glyphs are semantic names too. material's registry type
 * names the four its own components ship; the same registry answers any name,
 * so an application that adds these four overrides them like the rest.
 */
const glyph = (name: keyof typeof PAGINATOR_ICONS): string =>
  getIcon(name as Parameters<typeof getIcon>[0], PAGINATOR_ICONS[name]);

const createButton = (
  getClass: (name: string) => string,
  modifier: string,
  label: string,
  icon: string,
  onClick: () => void,
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${getClass(PAGINATOR_CLASSES.BUTTON)} ${getClass(modifier)}`;
  button.setAttribute("aria-label", label);
  const holder = document.createElement("span");
  holder.setAttribute("aria-hidden", "true");
  setHTML(holder, icon);
  button.appendChild(holder);
  button.addEventListener("click", onClick);
  return button;
};

/**
 * The first, previous, next and last controls, with the numbered page
 * container between previous and next. Every button asks the core to move;
 * the core decides whether the move is one the model can take.
 */
export const withNavigation = (
  settings: PaginatorSettings,
  getClass: (name: string) => string,
  live: () => { page: number; pageCount: number },
  goTo: (target: number) => void,
): NavigationFeature => {
  const element = document.createElement("div");
  element.className = getClass(PAGINATOR_CLASSES.NAVIGATION);

  const first = createButton(
    getClass, PAGINATOR_CLASSES.BUTTON_FIRST, settings.firstLabel, glyph("first-page"), () => goTo(1),
  );
  const prev = createButton(
    getClass, PAGINATOR_CLASSES.BUTTON_PREV, settings.prevLabel, glyph("chevron-left"),
    () => goTo(live().page - 1),
  );
  const next = createButton(
    getClass, PAGINATOR_CLASSES.BUTTON_NEXT, settings.nextLabel, glyph("chevron-right"),
    () => goTo(live().page + 1),
  );
  const last = createButton(
    getClass, PAGINATOR_CLASSES.BUTTON_LAST, settings.lastLabel, glyph("last-page"),
    () => goTo(live().pageCount),
  );

  const pages = document.createElement("div");
  pages.className = getClass(PAGINATOR_CLASSES.PAGES);

  element.append(first, prev, pages, next, last);

  const sync = (page: number, pageCount: number, disabled: boolean, ends: boolean): void => {
    first.hidden = !ends;
    last.hidden = !ends;
    first.disabled = disabled || page <= 1;
    prev.disabled = disabled || page <= 1;
    next.disabled = disabled || page >= pageCount;
    last.disabled = disabled || page >= pageCount;
  };

  return { element, pages, buttons: { first, prev, next, last }, sync };
};
