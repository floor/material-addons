import { createBadge, type BadgeComponent } from "material/components/badge";
import type { FabPlacement } from "material/components/fab";
import { AVATAR_CLASSES } from "../constants";
import type { AvatarBadgeConfig } from "../types";

export function withBadge(shape: HTMLElement) {
  let badge: BadgeComponent | undefined;
  return {
    set(config: AvatarBadgeConfig | undefined) {
      badge?.destroy();
      badge = config && createBadge({ ...config, variant: config.variant ?? "small", class: AVATAR_CLASSES.BADGE });
      badge?.element.setAttribute("aria-hidden", "true");
    },
    place(placement: FabPlacement) {
      if (!badge) return;
      badge.element.dataset.placement = placement;
      if (placement === "none") shape.after(badge.element);
      else shape.append(badge.element);
    },
    name() {
      if (!badge?.isVisible()) return "";
      return badge.element.getAttribute("aria-label") || badge.getLabel();
    },
    destroy() { badge?.destroy(); },
  };
}
