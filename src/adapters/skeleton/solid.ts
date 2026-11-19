import { onMount, splitProps, type Component, type JSX } from "solid-js";
import { Dynamic, isServer } from "solid-js/web";
import { toAttribute } from "material/elements";
import { initialize, skeletonHost, skeletonKeys, tag, type SkeletonProps } from "./contract";
import type { SkeletonElement } from "../../elements/skeleton";

export type SolidSkeletonProps = SkeletonProps & { ref?: (element: SkeletonElement) => void } &
  Omit<JSX.HTMLAttributes<SkeletonElement>, keyof SkeletonProps | "ref">;

export function createSolidSkeleton(): Component<SolidSkeletonProps> {
  return props => {
    const [, rest] = splitProps(props, [...skeletonKeys, "ref"] as (keyof SolidSkeletonProps)[]);
    let element: SkeletonElement | undefined;
    onMount(() => { if (element) initialize(); });
    const mapped: Record<string, unknown> = {};
    for (const [key, attribute] of skeletonHost.attributes) {
      Object.defineProperty(mapped, isServer ? attribute.name : `attr:${attribute.name}`, {
        enumerable: true, get() {
          const value = toAttribute(attribute.type, props[key as keyof SkeletonProps]);
          return attribute.type === "boolean" && value !== undefined ? true : value;
        },
      });
    }
    return Dynamic(Object.assign(rest, mapped, {
      component: tag(),
      ref(node: SkeletonElement) { element = node; props.ref?.(node); },
    }) as never);
  };
}
