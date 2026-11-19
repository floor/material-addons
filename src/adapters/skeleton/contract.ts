import { describe, getPrefix, toAttribute, type ElementProps } from "material/elements";
import type { SkeletonMotion, SkeletonSize, SkeletonVariant } from "../../components/skeleton";
import { defineSkeleton, skeletonElement, type SkeletonElement, type SkeletonSpec } from "../../elements/skeleton";

type Attributes = ElementProps<SkeletonSpec>;
/** The element chooses the prop names; the factory narrows its option values. */
export type SkeletonProps = Omit<Attributes, "variant" | "size" | "motion" | "lines" | "busy"> & {
  variant?: SkeletonVariant | string;
  size?: SkeletonSize | string;
  motion?: SkeletonMotion | string;
  lines?: number;
  busy?: boolean;
};

export const skeletonHost = describe(skeletonElement.spec);
export const skeletonKeys = [...skeletonHost.attributes.keys()];
export const tag = () => `${getPrefix()}-skeleton`;

export function attributes(props: SkeletonProps) {
  return Object.fromEntries([...skeletonHost.attributes].map(([key, attribute]) =>
    [attribute.name, toAttribute(attribute.type, props[key as keyof SkeletonProps])]));
}

export function hostProps(props: object, excluded: readonly string[]) {
  const own = new Set([...skeletonKeys, ...excluded]);
  return Object.fromEntries(Object.entries(props).filter(([key]) => !own.has(key)));
}

export function initialize() {
  defineSkeleton({ prefix: getPrefix() });
}
