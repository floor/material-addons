// src/components/skeleton/types.ts

/** The placeholder shape: text bars, the avatar circle, or a block. */
export type SkeletonVariant = "text" | "circle" | "rect";

/** The size axis. A circle uses the same boxes as the avatar. */
export type SkeletonSize = "small" | "medium" | "large";

/** How the highlight moves: the directional sweep, or a contained pulse. */
export type SkeletonMotion = "pulse" | "wave";

/** Skeleton configuration. No `value`: the skeleton is indeterminate. */
export interface SkeletonConfig {
  /** Shape. Default `text`. An unknown variant falls back to `text`. */
  variant?: SkeletonVariant | string;
  /** Block size. Default `medium`. */
  size?: SkeletonSize | string;
  /**
   * Text bar count, for `variant: "text"`. The same option name `ListItem`
   * uses. Any integer >= 1: a page placeholder is not a list row. Ignored
   * for `circle` and `rect`.
   */
  lines?: number;
  /** `wave` (default) or `pulse`. A motion, not a second variant. */
  motion?: SkeletonMotion | string;
  /**
   * When false, this root does not set `aria-busy`. Default true for a
   * standalone skeleton; a layout sets busy on its own region.
   */
  busy?: boolean;
  /** CSS classes, as the shared configuration takes them. */
  class?: string;
  componentName?: string;
}

/** The skeleton component. Not a control: no focus, no events. */
export interface SkeletonComponent {
  element: HTMLElement;
  getVariant: () => SkeletonVariant;
  setVariant: (variant: SkeletonVariant | string) => SkeletonComponent;
  getSize: () => SkeletonSize;
  setSize: (size: SkeletonSize | string) => SkeletonComponent;
  getLines: () => number;
  setLines: (lines: number) => SkeletonComponent;
  getMotion: () => SkeletonMotion;
  setMotion: (motion: SkeletonMotion | string) => SkeletonComponent;
  isBusy: () => boolean;
  setBusy: (busy: boolean) => SkeletonComponent;
  destroy: () => void;
}
