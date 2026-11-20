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

  const render = ({ page, pageCount, disabled }: { page: number; pageCount: number; disabled: boolean }): void => {
    container.replaceChildren();
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
        button.addEventListener("click", () => goTo(missing));
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
      button.addEventListener("click", () => goTo(candidate));
      container.append(button);
      previous = candidate;
    }
  };

  return { render, destroy: () => container.replaceChildren() };
};
