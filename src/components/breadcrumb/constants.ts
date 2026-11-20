// src/components/breadcrumb/constants.ts

export const BREADCRUMB_EVENTS = {
  BEFORE_CHANGE: "beforechange",
  CHANGE: "change",
} as const;

/** BEM names without the prefix */
export const BREADCRUMB_CLASSES = {
  ROOT: "breadcrumb",
  LIST: "breadcrumb__list",
  ITEM: "breadcrumb__item",
  ITEM_CURRENT: "breadcrumb__item--current",
  ITEM_OVERFLOW: "breadcrumb__item--overflow",
  SEPARATOR: "breadcrumb__separator",
  LINK: "breadcrumb__link",
  CURRENT: "breadcrumb__current",
  OVERFLOW: "breadcrumb__overflow",
  MENU: "breadcrumb__menu",
  MENU_ITEM: "breadcrumb__menu-item",
} as const;

export const BREADCRUMB_MODIFIERS = {
  DISABLED: "breadcrumb--disabled",
} as const;

export const BREADCRUMB_DEFAULTS = {
  ARIA_LABEL: "Breadcrumb",
  OVERFLOW_LABEL: "Show collapsed pages",
  COLLAPSE: true,
  DISABLED: false,
  COMPONENT_NAME: "breadcrumb",
} as const;

/** Inline fallbacks, used when the icon registry has no entry */
export const BREADCRUMB_ICONS = {
  "chevron-right": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>',
  "more-horiz": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',
} as const;

export type BreadcrumbIconName = keyof typeof BREADCRUMB_ICONS;
