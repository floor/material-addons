export const AVATAR_VARIANTS = { IMAGE: "image", TEXT: "text", ICON: "icon" } as const;
export const AVATAR_SIZES = { SMALL: "small", MEDIUM: "medium", LARGE: "large" } as const;
export const AVATAR_SHAPES = { ROUND: "round", SQUARE: "square" } as const;
export const AVATAR_PLACEMENTS = {
  NONE: "none", TOP_START: "top-start", TOP_END: "top-end", BOTTOM_START: "bottom-start", BOTTOM_END: "bottom-end",
} as const;
export const AVATAR_CLASSES = {
  ROOT: "mtrl-avatar",
  SHAPE: "mtrl-avatar__shape",
  CONTENT: "mtrl-avatar__content",
  TEXT: "mtrl-avatar__text",
  META: "mtrl-avatar__meta",
  LABEL: "mtrl-avatar__label",
  SUPPORTING: "mtrl-avatar__supporting",
  BADGE: "mtrl-avatar__badge",
} as const;
export const AVATAR_DEFAULTS = {
  variant: AVATAR_VARIANTS.IMAGE,
  size: AVATAR_SIZES.LARGE,
  shape: AVATAR_SHAPES.ROUND,
  text: "",
  placement: AVATAR_PLACEMENTS.TOP_END,
  disabled: false,
} as const;
