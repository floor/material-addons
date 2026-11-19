import { createBase, pipe, withElement } from "material/core/compose";
import { avatarSettings, getElementConfig, option } from "./config";
import { AVATAR_DEFAULTS, AVATAR_PLACEMENTS, AVATAR_SHAPES, AVATAR_SIZES, AVATAR_VARIANTS } from "./constants";
import { withRenderer } from "./features/withRenderer";
import type { AvatarComponent, AvatarConfig } from "./types";

/** @internal Updates the client element's native control when a host listener is attached. */
export function createAvatarController(config: AvatarConfig = {}) {
  const settings = avatarSettings(config);
  const renderer = pipe(createBase, withElement(getElementConfig(settings)), withRenderer(settings))({ componentName: "avatar", ...config });
  const avatar: AvatarComponent = {
    get element() { return renderer.element; },
    getVariant: () => settings.variant,
    setVariant(value) {
      renderer.setModifier("variant", option(AVATAR_VARIANTS, value, AVATAR_DEFAULTS.variant));
      renderer.renderVariant();
      return this;
    },
    getSize: () => settings.size,
    setSize(value) { renderer.setModifier("size", option(AVATAR_SIZES, value, AVATAR_DEFAULTS.size)); return this; },
    getShape: () => settings.shape,
    setShape(value) { renderer.setModifier("shape", option(AVATAR_SHAPES, value, AVATAR_DEFAULTS.shape)); return this; },
    getText: () => settings.text,
    setText(value) { settings.text = value; renderer.renderText(); return this; },
    getLabel: () => settings.label,
    setLabel(value) { settings.label = value; renderer.renderMeta(); return this; },
    getSupportingText: () => settings.supportingText,
    setSupportingText(value) { settings.supportingText = value; renderer.renderMeta(); return this; },
    getPlacement: () => settings.placement,
    setPlacement(value) {
      settings.placement = option(AVATAR_PLACEMENTS, value, AVATAR_DEFAULTS.placement);
      renderer.placeBadge();
      return this;
    },
    isDisabled: () => settings.disabled,
    setDisabled(value) { renderer.setDisabled(value); return this; },
    setContent(value) { renderer.setContent(value); return this; },
    setBadge(value) { renderer.setBadge(value); return this; },
    destroy: renderer.destroy,
  };

  return Object.assign(avatar, {
    setInteractive: renderer.setInteractive,
    setAriaLabel(value: string | undefined) { settings.ariaLabel = value; renderer.updateName(); },
    setDecorative(value: boolean) { settings.decorative = value; renderer.updateName(); },
  });
}

/** Creates an image, monogram or icon avatar with optional text and badge. */
export function createAvatar(config: AvatarConfig = {}): AvatarComponent {
  return createAvatarController(config);
}
