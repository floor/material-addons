import type { ElementComponent } from "material/core/compose";
import { ALERT_CLASSES, ALERT_EVENTS } from "../constants";
import type { AlertSettings } from "../config";
import type { AlertBeforeDismissEvent, AlertDismissEvent, AlertDismissReason } from "../types";

export function withDismiss(settings: AlertSettings) {
  return <C extends ElementComponent & {
    emit?: (event: string, payload: unknown) => void;
    setDismissHandler?: (handler: (reason: AlertDismissReason) => void) => void;
  }>(component: C) => {
    const root = component.element;
    let open = Boolean(settings.open);
    const stateListeners: Array<(isOpen: boolean) => void> = [];

    function applyInitialState() {
      if (!open) {
        root.classList.add(ALERT_CLASSES.CLOSED);
        root.hidden = true;
      } else {
        root.classList.remove(ALERT_CLASSES.CLOSED);
        root.hidden = false;
      }
    }

    function notifyState() {
      for (const listener of stateListeners) listener(open);
    }

    function dismiss(reason: AlertDismissReason = "programmatic"): boolean {
      if (!open) return false;
      let prevented = false;
      const beforePayload: AlertBeforeDismissEvent = {
        severity: settings.severity,
        reason,
        preventDefault() {
          prevented = true;
        },
        get defaultPrevented() {
          return prevented;
        },
      };
      settings.onBeforeDismiss?.(beforePayload);
      component.emit?.(ALERT_EVENTS.BEFORE_DISMISS, beforePayload);
      if (prevented) return false;

      open = false;
      settings.open = false;
      root.classList.add(ALERT_CLASSES.CLOSED);
      root.toggleAttribute("inert", true);
      root.hidden = true;
      root.toggleAttribute("inert", false);
      notifyState();

      const dismissPayload: AlertDismissEvent = {
        severity: settings.severity,
        reason,
      };
      settings.onDismiss?.(dismissPayload);
      component.emit?.(ALERT_EVENTS.DISMISS, dismissPayload);
      return true;
    }

    function show(): void {
      if (open) return;
      open = true;
      settings.open = true;
      root.classList.remove(ALERT_CLASSES.CLOSED);
      root.toggleAttribute("inert", false);
      root.hidden = false;
      notifyState();
    }

    applyInitialState();
    component.setDismissHandler?.(dismiss);

    return {
      ...component,
      isOpen: () => open,
      show,
      dismiss,
      onOpenStateChange(listener: (isOpen: boolean) => void) {
        stateListeners.push(listener);
        return () => {
          const idx = stateListeners.indexOf(listener);
          if (idx >= 0) stateListeners.splice(idx, 1);
        };
      },
    };
  };
}
