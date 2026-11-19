import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import { initialize, type SkeletonProps } from "./contract";

import type { SkeletonElement } from "../../elements/skeleton";

export { attributes, hostProps, tag } from "./contract";
export type SvelteSkeletonProps = SkeletonProps & { children?: Snippet } &
  Omit<HTMLAttributes<HTMLElement>, keyof SkeletonProps | "children">;

export function connectSkeleton(node: SkeletonElement) {
  // The svelte action runs on mount: define the element, so the authored
  // attributes upgrade into a live placeholder.
  void node;
  initialize();
}
