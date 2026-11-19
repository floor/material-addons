import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import { type SkeletonProps } from "./contract";

export { attributes, hostProps, tag } from "./contract";
export type SvelteSkeletonProps = SkeletonProps & { children?: Snippet } &
  Omit<HTMLAttributes<HTMLElement>, keyof SkeletonProps | "children">;

export function connectSkeleton() {
  // The skeleton has no events and no model: there is nothing to connect
  // beyond the definition the contract's initialize already made.
}
