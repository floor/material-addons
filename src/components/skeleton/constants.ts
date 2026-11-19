// src/components/skeleton/constants.ts

import type { SkeletonMotion, SkeletonSize, SkeletonVariant } from "./types";

/** The placeholder shapes. */
export const SKELETON_VARIANTS = ["text", "circle", "rect"] as const;

/** The size axis; a circle uses the avatar boxes. */
export const SKELETON_SIZES = ["small", "medium", "large"] as const;

/** The motions. `variant` is the shape; how it animates is a motion. */
export const SKELETON_MOTIONS = ["pulse", "wave"] as const;

/** BEM part names, kebab case after `__`. */
export const SKELETON_CLASSES = {
  ROOT: "mtrl-skeleton",
  SHAPE: "mtrl-skeleton__shape",
  LINE: "mtrl-skeleton__line",
  HOST: "mtrl-skeleton-host",
} as const;

/** The attribute the wave reads its group geometry from (spec section 6). */
export const SKELETON_WAVE_ATTRIBUTE = "data-mtrl-skeleton-wave";

export const SKELETON_DEFAULTS = {
  VARIANT: "text",
  SIZE: "medium",
  LINES: 1,
  MOTION: "wave",
  BUSY: true,
} as const;

export type { SkeletonMotion, SkeletonSize, SkeletonVariant };
