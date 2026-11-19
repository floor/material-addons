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

/** The plain spelling of a host key: defaultSize -> size. */
const plainKey = (key: string): string => key.replace(/^default(.)/, (_, first: string) => first.toLowerCase());

export function attributes(props: SkeletonProps) {
  return Object.fromEntries([...skeletonHost.attributes].map(([key, attribute]) => {
    const plain = plainKey(key);
    const value = props[key as keyof SkeletonProps] ?? (plain in props ? props[plain as keyof SkeletonProps] : undefined);
    return [attribute.name, toAttribute(attribute.type, value)];
  }));
}

/**
 * Apply the authored props to the element as attributes, both spellings.
 * React assigns a prop like `size` as a property when the upgraded element
 * has one, and the attribute never lands; setting it here reaches the
 * placeholder whatever React did with the prop.
 */
export function applyProps(element: SkeletonElement, props: SkeletonProps) {
  for (const [key, attribute] of skeletonHost.attributes) {
    const plain = plainKey(key);
    const value = props[key as keyof SkeletonProps] ?? (plain in props ? props[plain as keyof SkeletonProps] : undefined);
    if (value === undefined || value === null) continue;
    const text = toAttribute(attribute.type, value);
    if (text !== undefined) element.setAttribute(attribute.name, text);
  }
}

export function hostProps(props: object, excluded: readonly string[]) {
  const own = new Set([...skeletonKeys, ...skeletonKeys.map(plainKey), ...excluded]);
  return Object.fromEntries(Object.entries(props).filter(([key]) => !own.has(key)));
}

export function initialize() {
  defineSkeleton({ prefix: getPrefix() });
}
