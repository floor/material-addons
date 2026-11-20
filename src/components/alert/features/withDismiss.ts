import type { ElementComponent } from "material/core/compose";
import { ALERT_CLASSES, ALERT_EVENTS } from "../constants";
import type { AlertSettings } from "../config";
import type { AlertBeforeDismissEvent, AlertDismissEvent, AlertDismissReason } from "../types";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]:not([contenteditable="false"])',
].join(",");

function isFocusableCandidate(node: HTMLElement, container: HTMLElement, root: HTMLElement): boolean {
  if (node === container || node === root || container.contains(node) || root.contains(node)) return false;
  if (node.tabIndex < 0) return false;
  if ((node as HTMLButtonElement).disabled || node.hasAttribute("disabled")) return false;
  if (node.closest("[hidden], [inert], [no-open], .mtrl-alert--closed, [aria-hidden='true']")) return false;
  const view = node.ownerDocument.defaultView;
  if (view) {
    const style = view.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

function isShadow(node: Node): node is ShadowRoot {
  return "host" in node && Boolean((node as ShadowRoot).host);
}

function findAdjacentFocusable(container: HTMLElement, root: HTMLElement): HTMLElement | null {
  const scopeNode = container.getRootNode();
  const queryRoot: ParentNode = "querySelectorAll" in scopeNode
    ? (scopeNode as ParentNode)
    : container.ownerDocument;
  const candidates = Array.from(queryRoot.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(node => isFocusableCandidate(node, container, root));

  let previous: HTMLElement | null = null;
  for (const candidate of candidates) {
    const pos = container.compareDocumentPosition(candidate);
    if (pos & 4) return candidate; // Node.DOCUMENT_POSITION_FOLLOWING
    if (pos & 2) previous = candidate; // Node.DOCUMENT_POSITION_PRECEDING
  }
  return previous;
}

function alertHadFocus(container: HTMLElement, root: HTMLElement): boolean {
  const rootNode = root.getRootNode();
  if (isShadow(rootNode) && rootNode.activeElement && root.contains(rootNode.activeElement)) {
    return true;
  }
  const active = root.ownerDocument.activeElement;
  if (!active || active === root.ownerDocument.body) return false;
  return active === container || active === root || root.contains(active) || container.contains(active);
}

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

      const rootNode = root.getRootNode();
      const container = (isShadow(rootNode) ? rootNode.host : root) as HTMLElement;
      const shouldMoveFocus = alertHadFocus(container, root);
      const nextFocus = shouldMoveFocus ? findAdjacentFocusable(container, root) : null;

      open = false;
      settings.open = false;
      root.classList.add(ALERT_CLASSES.CLOSED);
      root.toggleAttribute("inert", true);
      root.hidden = true;
      root.toggleAttribute("inert", false);
      notifyState();

      if (nextFocus) {
        nextFocus.focus();
      }

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
