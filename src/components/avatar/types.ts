import type { BadgeConfig } from "material/components/badge";
import type { FabPlacement } from "material/components/fab";
import type { AVATAR_SHAPES, AVATAR_SIZES, AVATAR_VARIANTS } from "./constants";

export type AvatarVariant = typeof AVATAR_VARIANTS[keyof typeof AVATAR_VARIANTS];
export type AvatarSize = typeof AVATAR_SIZES[keyof typeof AVATAR_SIZES];
export type AvatarShape = typeof AVATAR_SHAPES[keyof typeof AVATAR_SHAPES];
export type AvatarBadgeConfig = Pick<BadgeConfig, "variant" | "label" | "color" | "max">;

export interface AvatarConfig {
  variant?: AvatarVariant | string;
  size?: AvatarSize | string;
  shape?: AvatarShape | string;
  /** The first two Unicode code points are displayed in the text variant. */
  text?: string;
  label?: string;
  supportingText?: string;
  disabled?: boolean;
  placement?: FabPlacement | string;
  /** Image or icon markup, processed with Material's configured HTML policy. */
  content?: string | HTMLElement;
  badge?: AvatarBadgeConfig;
  ariaLabel?: string;
  decorative?: boolean;
  href?: string;
  target?: string;
  rel?: string;
  onClick?: (event: MouseEvent) => void;
  class?: string;
  className?: string;
  componentName?: string;
}

export interface AvatarComponent {
  readonly element: HTMLElement;
  getVariant(): AvatarVariant;
  setVariant(variant: string): this;
  getSize(): AvatarSize;
  setSize(size: string): this;
  getShape(): AvatarShape;
  setShape(shape: string): this;
  getText(): string;
  setText(text: string): this;
  getLabel(): string | undefined;
  setLabel(label: string | undefined): this;
  getSupportingText(): string | undefined;
  setSupportingText(text: string | undefined): this;
  isDisabled(): boolean;
  setDisabled(disabled: boolean): this;
  getPlacement(): FabPlacement;
  setPlacement(placement: string): this;
  setContent(content: AvatarConfig["content"]): this;
  setBadge(badge: AvatarBadgeConfig | undefined): this;
  destroy(): void;
}
