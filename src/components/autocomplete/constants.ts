export const AUTOCOMPLETE_VARIANTS = { FILLED: "filled", OUTLINED: "outlined" } as const;
export const AUTOCOMPLETE_DENSITY = { DEFAULT: "default", COMPACT: "compact" } as const;
export const AUTOCOMPLETE_PLACEMENTS = {
  BOTTOM_START: "bottom-start", BOTTOM_END: "bottom-end",
  TOP_START: "top-start", TOP_END: "top-end",
} as const;
export const AUTOCOMPLETE_EVENTS = {
  INPUT: "input", SELECT: "select", CHANGE: "change", OPEN: "open", CLOSE: "close", CLEAR: "clear",
} as const;
export const AUTOCOMPLETE_CLASSES = {
  ROOT: "mtrl-autocomplete",
  OPEN: "mtrl-autocomplete--open",
  LOADING: "mtrl-autocomplete--loading",
  LISTBOX: "mtrl-autocomplete__listbox",
  COMPACT: "mtrl-autocomplete__listbox--compact",
  OPTION_ICON: "mtrl-autocomplete__option-icon",
  OPTION_CONTENT: "mtrl-autocomplete__option-content",
  OPTION_TEXT: "mtrl-autocomplete__option-text",
  OPTION_SUPPORTING_TEXT: "mtrl-autocomplete__option-supporting-text",
  MATCH: "mtrl-autocomplete__match",
  EMPTY: "mtrl-autocomplete__empty",
  STATUS: "mtrl-autocomplete__status",
} as const;
export const AUTOCOMPLETE_DEFAULTS = {
  variant: AUTOCOMPLETE_VARIANTS.FILLED, density: AUTOCOMPLETE_DENSITY.DEFAULT,
  placement: AUTOCOMPLETE_PLACEMENTS.BOTTOM_START, componentName: "autocomplete",
  strict: false, openOnFocus: true, clearable: true, highlightMatch: true, autoHighlight: false,
  minLength: 0, debounce: 0, sourceDebounce: 150, emptyText: "", loadingText: "Loading…",
  maxHeight: "320px",
} as const;
