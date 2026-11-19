// src/components/expansion-panel/features/withAccordionKeyboard.ts

import { EXPANSION_PANEL_CLASSES } from "../constants";
import type { AccordionComponent } from "../types";

const headerClass = (element: HTMLElement): string => {
  const prefix = element.className
    .split(/\s+/)
    .find((name) => name.endsWith(`-${EXPANSION_PANEL_CLASSES.ROOT}`))
    ?.replace(new RegExp(`-${EXPANSION_PANEL_CLASSES.ROOT}$`), "");
  return `${prefix ?? "mtrl"}-${EXPANSION_PANEL_CLASSES.HEADER}`;
};

/**
 * Arrow keys move focus between enabled panel headers, wrapping at the ends;
 * Home and End go to the ends. Focus only: Enter and Space are the header
 * button's own click.
 */
export const withAccordionKeyboard = (
  container: HTMLElement,
  headers: () => HTMLButtonElement[],
): (() => void) => {
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    if (!target || !target.classList.contains(headerClass(container))) return;
    const list = headers().filter((header) => !header.disabled);
    if (!list.length) return;
    const from = list.indexOf(target as HTMLButtonElement);
    if (from === -1) return;
    let next: number;
    if (event.key === "ArrowDown") next = (from + 1) % list.length;
    else if (event.key === "ArrowUp") next = (from - 1 + list.length) % list.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = list.length - 1;
    else return;
    event.preventDefault();
    list[next]!.focus();
  };

  container.addEventListener("keydown", onKeydown);
  return () => container.removeEventListener("keydown", onKeydown);
};
