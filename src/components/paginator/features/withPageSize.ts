// src/components/paginator/features/withPageSize.ts

import { PAGINATOR_CLASSES } from "../constants";
import type { PaginatorSettings } from "../config";

export interface PageSizeFeature {
  element: HTMLElement;
  select: HTMLSelectElement;
  /** Draws the options and the selected one */
  sync: (pageSize: number, pageSizes: number[]) => void;
  /** Removes the listener the control added */
  destroy: () => void;
}

/**
 * The rows-per-page control: a native select, so the platform listbox keys
 * apply and the label is a real `<label for>`.
 */
export const withPageSize = (
  settings: PaginatorSettings,
  getClass: (name: string) => string,
  uid: string,
  onChoose: (pageSize: number) => void,
): PageSizeFeature => {
  const element = document.createElement("div");
  element.className = getClass(PAGINATOR_CLASSES.PAGE_SIZE);

  const label = document.createElement("label");
  label.className = getClass(PAGINATOR_CLASSES.PAGE_SIZE_LABEL);
  label.setAttribute("for", `${uid}-page-size`);
  label.textContent = settings.pageSizeLabel;

  const select = document.createElement("select");
  select.className = getClass(PAGINATOR_CLASSES.PAGE_SIZE_SELECT);
  select.id = `${uid}-page-size`;
  const choose = (): void => onChoose(Number(select.value));
  select.addEventListener("change", choose);

  element.append(label, select);

  const sync = (pageSize: number, pageSizes: number[]): void => {
    // The current size stays selectable even when the list does not carry it
    const options = pageSizes.includes(pageSize) ? pageSizes : [...pageSizes, pageSize];
    select.replaceChildren(
      ...options.map((size) => {
        const option = document.createElement("option");
        option.value = String(size);
        option.textContent = String(size);
        return option;
      }),
    );
    select.value = String(pageSize);
  };

  return { element, select, sync, destroy: () => select.removeEventListener("change", choose) };
};
