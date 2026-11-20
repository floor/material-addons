export const RATING_SIZES = {
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large",
} as const;

export const RATING_EVENTS = {
  CHANGE: "change",
  HOVER: "hover",
} as const;

export const RATING_CLASSES = {
  ROOT: "mtrl-rating",
  LABEL: "mtrl-rating__label",
  ROW: "mtrl-rating__row",
  GROUP: "mtrl-rating__group",
  STAR: "mtrl-rating__star",
  STAR_FULL: "mtrl-rating__star--full",
  STAR_HALF: "mtrl-rating__star--half",
  STAR_EMPTY: "mtrl-rating__star--empty",
  STAR_FRACTION: "mtrl-rating__star--fraction",
  STAR_VISUAL: "mtrl-rating__star-visual",
  STAR_EMPTY_ICON: "mtrl-rating__star-empty",
  STAR_FILL_ICON: "mtrl-rating__star-fill",
  STOP: "mtrl-rating__stop",
  STOP_HALF: "mtrl-rating__stop--half",
  STOP_FULL: "mtrl-rating__stop--full",
  VALUE: "mtrl-rating__value",
  SUPPORTING_TEXT: "mtrl-rating__supporting-text",
  INPUT: "mtrl-rating__input",
  HOVERING: "mtrl-rating--hovering",
  READ_ONLY: "mtrl-rating--read-only",
  DISABLED: "mtrl-rating--disabled",
  ERROR: "mtrl-rating--error",
} as const;

export const RATING_DEFAULTS = {
  VALUE: 0,
  MAX: 5,
  HALF: false,
  READ_ONLY: false,
  DISABLED: false,
  REQUIRED: false,
  NO_CLEAR: false,
  SIZE: RATING_SIZES.MEDIUM,
  ARIA_LABEL: "Rating",
} as const;

const STAR_PATH = "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

export const RATING_ICONS = {
  FILLED: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="${STAR_PATH}"/></svg>`,
  EMPTY: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="${STAR_PATH}"/></svg>`,
} as const;
