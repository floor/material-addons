// src/components/paginator/constants.ts

export const PAGINATOR_EVENTS = {
  BEFORE_CHANGE: "beforechange",
  CHANGE: "change",
} as const;

/** BEM names without the prefix */
export const PAGINATOR_CLASSES = {
  ROOT: "paginator",
  PAGE_SIZE: "paginator__page-size",
  PAGE_SIZE_LABEL: "paginator__page-size-label",
  PAGE_SIZE_SELECT: "paginator__page-size-select",
  RANGE: "paginator__range",
  NAVIGATION: "paginator__navigation",
  BUTTON: "paginator__button",
  BUTTON_FIRST: "paginator__button--first",
  BUTTON_PREV: "paginator__button--prev",
  BUTTON_NEXT: "paginator__button--next",
  BUTTON_LAST: "paginator__button--last",
  PAGES: "paginator__pages",
  PAGE: "paginator__page",
  PAGE_CURRENT: "paginator__page--current",
  ELLIPSIS: "paginator__ellipsis",
} as const;

export const PAGINATOR_MODIFIERS = {
  DISABLED: "paginator--disabled",
} as const;

export const PAGINATOR_DEFAULTS = {
  PAGE: 1,
  PAGE_SIZE: 25,
  PAGE_SIZES: [10, 25, 50, 100],
  TOTAL: 0,
  NUMBERED: false,
  SIBLING_COUNT: 1,
  BOUNDARY_COUNT: 1,
  ENDS: true,
  DISABLED: false,
  ARIA_LABEL: "Pagination",
  PAGE_SIZE_LABEL: "Rows per page",
  FIRST_LABEL: "First page",
  PREV_LABEL: "Previous page",
  NEXT_LABEL: "Next page",
  LAST_LABEL: "Last page",
  COMPONENT_NAME: "paginator",
  PREFIX: "mtrl",
} as const;

/** Inline fallbacks, used when the icon registry has no entry */
export const PAGINATOR_ICONS = {
  "first-page": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18.41 16.59-4.59-4.59 4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z"/></svg>',
  "chevron-left": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>',
  "chevron-right": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>',
  "last-page": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.59 7.41 10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z"/></svg>',
} as const;

export type PaginatorIconName = keyof typeof PAGINATOR_ICONS;
