// src/components/skeleton/map.ts

/**
 * The creator map: which placeholder a component's creator stands in as.
 *
 * `registerSkeleton(creator, map)` stores a function from the creator's own
 * options to a `SkeletonConfig`; `skeletonFor(creator, options)` reads it. An
 * unknown function creator maps to `{ variant: "rect" }` — a block the size
 * of the coming component. The internal layout element creator (a plain
 * `div`) is never a skeleton: it renders, and holds the layout.
 */

import type { SkeletonConfig } from "./types";

/** Reads a creator's options into the placeholder it stands in as. */
export type SkeletonMapping = (options: Record<string, any>) => SkeletonConfig;

const mappings = new WeakMap<Function, SkeletonMapping>();

/** Register (or replace) the placeholder mapping for a creator. */
export const registerSkeleton = (creator: Function, map: SkeletonMapping): void => {
  mappings.set(creator, map);
};

/** The placeholder config a creator's options map to. Unknown creators are a rect. */
export const skeletonFor = (creator: Function, options: Record<string, any> = {}): SkeletonConfig => {
  const mapping = mappings.get(creator);
  return mapping ? mapping(options) : { variant: "rect" };
};
