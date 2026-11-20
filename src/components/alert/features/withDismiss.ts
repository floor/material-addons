import type { ElementComponent } from "material/core/compose";
import { ALERT_CLASSES, ALERT_EVENTS } from "../constants";
import type { AlertSettings } from "../config";
import type { AlertBeforeDismissEvent, AlertDismissEvent, AlertDismissReason } from "../types";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not(:disabled)",
  'input:not(:disabled):not([type="hidden"])',
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]:not([contenteditable="false"])',
].join(",");

function isShadow(node: Node): node is ShadowRoot {
  return "host" in node && Boolean((node as ShadowRoot).host);
}

function isEligibleFocusable(node: HTMLElement, container: HTMLElement, root: HTMLElement): boolean {
  if (node === container || node === root || container.contains(node) || root.contains(node)) return false;
  if (node.tabIndex < 0) return false;
  if ((node as HTMLButtonElement).disabled || node.hasAttribute("disabled") || node.matches?.(":disabled")) return false;
  if (node.closest("[hidden], [inert], [no-open], .mtrl-alert--closed, [aria-hidden='true']")) return false;
  const view = node.ownerDocument.defaultView;
  if (view) {
    let current: HTMLElement | null = node;
    while (current) {
      const style = view.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const parent: HTMLElement | null = current.parentElement;
      if (parent) {
        current = parent;
      } else {
        const rootNode = current.getRootNode();
        current = isShadow(rootNode) ? (rootNode.host as HTMLElement) : null;
      }
    }
  }
  return true;
}

function activeElementOf(scope: Node, doc: Document): Element | null {
  if (isShadow(scope) && scope.activeElement) return scope.activeElement;
  return doc.activeElement;
}

function focusAdjacent(container: HTMLElement, root: HTMLElement): void {
  const scopeNode = container.getRootNode();
  const doc = container.ownerDocument;
  const queryRoot: ParentNode = "querySelectorAll" in scopeNode
    ? (scopeNode as ParentNode)
    : doc;
  const all = Array.from(queryRoot.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

  const following: HTMLElement[] = [];
  const preceding: HTMLElement[] = [];
  for (const candidate of all) {
    if (candidate === container || candidate === root || container.contains(candidate) || root.contains(candidate)) continue;
    const pos = container.compareDocumentPosition(candidate);
    if (pos & 4) following.push(candidate); // Node.DOCUMENT_POSITION_FOLLOWING
    else if (pos & 2) preceding.push(candidate); // Node.DOCUMENT_POSITION_PRECEDING
  }
  preceding.reverse();

  for (const candidate of [...following, ...preceding]) {
    if (!isEligibleFocusable(candidate, container, root)) continue;
    candidate.focus();
    const active = activeElementOf(candidate.getRootNode(), doc);
    if (active === candidate || doc.activeElement === candidate) return;
  }
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

      open = false;
      settings.open = false;
      root.classList.add(ALERT_CLASSES.CLOSED);
      root.toggleAttribute("inert", true);
      root.hidden = true;
      root.toggleAttribute("inert", false);
      notifyState();

      if (shouldMoveFocus) {
        focusAdjacent(container, root);
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
