// src/components/paginator/features/withNumberedPages.ts

import { PAGINATOR_CLASSES } from "../constants";
import type { PaginatorSettings } from "../config";

export interface NumberedPagesFeature {
  /** Draws the page list, or nothing when numbered is off */
  render: (state: { page: number; pageCount: number; disabled: boolean }) => void;
  /** Drops the page buttons and the listeners they carry */
  destroy: () => void;
}

/**
 * The visible page numbers: the boundaries, the current page's siblings, and
 * the trailing boundaries. A one-page gap renders that page; a larger one is
 * an ellipsis, which is not a control.
 */
export const withNumberedPages = (
  settings: PaginatorSettings,
  getClass: (name: string) => string,
  container: HTMLElement,
  goTo: (target: number) => void,
): NumberedPagesFeature => {
  const wanted = (page: number, pageCount: number): number[] => {
    const pages = new Set<number>();
    const add = (from: number, to: number): void => {
      for (let candidate = Math.max(1, from); candidate <= Math.min(pageCount, to); candidate++) pages.add(candidate);
    };
    add(1, settings.boundaryCount);
    add(page - settings.siblingCount, page + settings.siblingCount);
    add(pageCount - settings.boundaryCount + 1, pageCount);
    return [...pages].sort((a, b) => a - b);
  };

  const label = (page: number): string => settings.pageLabel?.(page) ?? `Page ${page}`;

  // The rebuilt buttons carry their own listeners: drop them before a
  // rebuild and on destroy, so a node held elsewhere cannot still commit
  let added: Array<() => void> = [];
  const clear = (): void => {
    added.forEach((remove) => remove());
    added = [];
    container.replaceChildren();
  };

  const render = ({ page, pageCount, disabled }: { page: number; pageCount: number; disabled: boolean }): void => {
    // A keyboard activation rebuilds the row under the focused button: keep
    // focus on the page it activated, now the current one
    const focused = container.contains(document.activeElement) ? document.activeElement?.textContent : null;
    clear();
    if (!settings.numbered) return;
    let previous = 0;
    for (const candidate of wanted(page, pageCount)) {
      if (previous && candidate - previous === 2) {
        // A single page between two shown pages is worth its own button
        const missing = previous + 1;
        const button = document.createElement("button");
        button.type = "button";
        button.className = getClass(PAGINATOR_CLASSES.PAGE);
        button.setAttribute("aria-label", label(missing));
        button.textContent = String(missing);
        button.disabled = disabled;
        const activateMissing = (): void => goTo(missing);
        button.addEventListener("click", activateMissing);
        added.push(() => button.removeEventListener("click", activateMissing));
        container.append(button);
      } else if (previous && candidate - previous > 2) {
        const ellipsis = document.createElement("span");
        ellipsis.className = getClass(PAGINATOR_CLASSES.ELLIPSIS);
        ellipsis.setAttribute("aria-hidden", "true");
        ellipsis.textContent = "…";
        container.append(ellipsis);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = getClass(PAGINATOR_CLASSES.PAGE);
      button.setAttribute("aria-label", label(candidate));
      button.textContent = String(candidate);
      button.disabled = disabled;
      if (candidate === page) {
        button.classList.add(getClass(PAGINATOR_CLASSES.PAGE_CURRENT));
        button.setAttribute("aria-current", "page");
      }
      const activate = (): void => goTo(candidate);
      button.addEventListener("click", activate);
      added.push(() => button.removeEventListener("click", activate));
      container.append(button);
      previous = candidate;
    }
    if (focused !== null) {
      const again = Array.from(container.querySelectorAll("button")).find((node) => node.textContent === focused);
      again?.focus();
    }
  };

  return { render, destroy: clear };
};
