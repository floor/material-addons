import { AVATAR_CLASSES, AVATAR_DEFAULTS, AVATAR_PLACEMENTS, AVATAR_SHAPES, AVATAR_SIZES, AVATAR_VARIANTS } from "./constants";
import type { AvatarConfig } from "./types";

export function option<T extends string>(values: Record<string, T>, value: string | undefined, fallback: T): T {
  return Object.values(values).find(candidate => candidate === value) ?? fallback;
}

export function getElementConfig(config: AvatarConfig) {
  return {
    tag: config.href != null ? "a" : config.onClick ? "button" : "div",
    className: [AVATAR_CLASSES.ROOT, config.class ?? config.className ?? ""],
  };
}

export function avatarSettings(config: AvatarConfig) {
  return {
    ...config,
    variant: option(AVATAR_VARIANTS, config.variant, AVATAR_DEFAULTS.variant),
    size: option(AVATAR_SIZES, config.size, AVATAR_DEFAULTS.size),
    shape: option(AVATAR_SHAPES, config.shape, AVATAR_DEFAULTS.shape),
    placement: option(AVATAR_PLACEMENTS, config.placement, AVATAR_DEFAULTS.placement),
    text: config.text ?? AVATAR_DEFAULTS.text,
    disabled: config.disabled ?? AVATAR_DEFAULTS.disabled,
  };
}

export type AvatarSettings = ReturnType<typeof avatarSettings>;
