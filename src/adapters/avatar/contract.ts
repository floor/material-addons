import { describe, getPrefix, toAttribute, type ElementProps } from "material/elements";
import type { BadgeColor, BadgeVariant } from "material/components/badge";
import type { FabPlacement } from "material/components/fab";
import type { AvatarShape, AvatarSize, AvatarVariant } from "../../components/avatar";
import { avatarElement, defineAvatar, type AvatarElement, type AvatarElementEventMap, type AvatarSpec } from "../../elements/avatar";

type Attributes = ElementProps<AvatarSpec>;
export type AvatarProps = Omit<Attributes, "shape" | "variant" | "size" | "placement" | "badgeColor" | "badgeVariant"> & {
  shape?: AvatarShape;
  variant?: AvatarVariant;
  size?: AvatarSize;
  placement?: FabPlacement;
  badgeColor?: BadgeColor;
  badgeVariant?: BadgeVariant;
};
export type AvatarClick = (event: AvatarElementEventMap["click"]) => void;

export const avatarHost = describe(avatarElement.spec);
export const avatarKeys = [...avatarHost.attributes.keys()];
export const tag = () => `${getPrefix()}-avatar`;

export function attributes(props: AvatarProps) {
  return Object.fromEntries([...avatarHost.attributes].map(([key, attribute]) =>
    [attribute.name, toAttribute(attribute.type, props[key as keyof AvatarProps])]));
}

export function hostProps(props: object, excluded: readonly string[]) {
  const own = new Set([...avatarKeys, ...excluded]);
  return Object.fromEntries(Object.entries(props).filter(([key]) => !own.has(key)));
}

export function initialize() {
  defineAvatar({ prefix: getPrefix() });
}

export function connectClick(element: AvatarElement) {
  const click = (event: MouseEvent) => current?.(event);
  let current: AvatarClick | undefined;
  function update(next: AvatarClick | undefined) {
    const hadClick = !!current;
    current = next;
    if (next && !hadClick) element.addEventListener("click", click);
    if (!next && hadClick) element.removeEventListener("click", click);
  }
  return { update, destroy() { update(undefined); } };
}
