// src/components/skeleton/index.ts

/**
 * Skeleton component module.
 *
 * The barrel exports the factory, the creator map and the public types. The
 * constants are read from `material-addons/components/skeleton/constants`.
 *
 * @module components/skeleton
 */

export { default as createSkeleton } from "./skeleton";
export { default } from "./skeleton";

export { registerSkeleton, skeletonFor } from "./map";
export type { SkeletonMapping } from "./map";

export type {
  SkeletonComponent,
  SkeletonConfig,
  SkeletonMotion,
  SkeletonSize,
  SkeletonVariant,
} from "./types";
