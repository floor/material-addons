import { setHTML } from "material/core/dom";
import { getIcon } from "material/core/icons";
import type { ElementComponent } from "material/core/compose";
import { ALERT_CLASSES, ALERT_EVENTS, ALERT_ICONS } from "../constants";
import type { AlertSettings } from "../config";
import type { AlertActionEvent, AlertDismissReason, AlertSeverity } from "../types";

function el<K extends keyof HTMLElementTagNameMap>(document: Document, tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function defaultRole(severity: AlertSeverity): "alert" | "status" {
  return severity === "warning" || severity === "error" ? "alert" : "status";
}

function defaultSeverityPrefix(severity: AlertSeverity): string {
  return `${severity[0].toUpperCase()}${severity.slice(1)}: `;
}

export function withRenderer(settings: AlertSettings) {
  return <C extends ElementComponent & {
    emit?: (event: string, payload: unknown) => void;
    on?: (event: string, handler: (...args: unknown[]) => void) => unknown;
    off?: (event: string, handler: (...args: unknown[]) => void) => unknown;
  }>(component: C) => {
    const root = component.element;
    const document = root.ownerDocument;

    const iconBox = el(document, "span", ALERT_CLASSES.ICON);
    iconBox.setAttribute("aria-hidden", "true");
    const iconFallback = el(document, "span");

    const contentBox = el(document, "div", ALERT_CLASSES.CONTENT);
    const srSeverity = el(document, "span", ALERT_CLASSES.SR_SEVERITY);
    const labelBox = el(document, "div", ALERT_CLASSES.LABEL);
    const supportingBox = el(document, "div", ALERT_CLASSES.SUPPORTING_TEXT);
    const supportingFallback = el(document, "span");

    const actionsBox = el(document, "div", ALERT_CLASSES.ACTIONS);
    const actionBtn = el(document, "button", ALERT_CLASSES.ACTION);
    actionBtn.type = "button";
    const dismissBtn = el(document, "button", ALERT_CLASSES.DISMISS);
    dismissBtn.type = "button";

    let bodySlot: HTMLSlotElement | undefined;
    let iconSlot: HTMLSlotElement | undefined;
    let actionSlot: HTMLSlotElement | undefined;
    let onDismissTrigger: ((reason: AlertDismissReason) => void) | undefined;

    function handleActionClick(event: MouseEvent) {
      const payload: AlertActionEvent = {
        severity: settings.severity,
        originalEvent: event,
      };
      settings.onAction?.(payload);
      component.emit?.(ALERT_EVENTS.ACTION, payload);
    }

    function handleDismissClick() {
      onDismissTrigger?.("button");
    }

    actionBtn.addEventListener("click", handleActionClick);
    dismissBtn.addEventListener("click", handleDismissClick);

    function setModifier<T extends "severity" | "variant">(key: T, value: AlertSettings[T]) {
      root.classList.remove(`${ALERT_CLASSES.ROOT}--${settings[key]}`);
      settings[key] = value;
      root.classList.add(`${ALERT_CLASSES.ROOT}--${value}`);
    }

    function updateRole() {
      const role = settings.role ?? defaultRole(settings.severity);
      root.setAttribute("role", role);
    }

    function renderSrSeverity() {
      const prefix = settings.severityLabel !== undefined
        ? settings.severityLabel
        : defaultSeverityPrefix(settings.severity);
      srSeverity.textContent = prefix;
      if (prefix) {
        if (srSeverity.parentElement !== contentBox) contentBox.prepend(srSeverity);
      } else {
        srSeverity.remove();
      }
    }

    function hasAssignedNodes(slot: HTMLSlotElement | undefined): boolean {
      if (!slot) return false;
      return slot.assignedNodes({ flatten: true }).some(n =>
        n.nodeType === 1 || (n.nodeType === 3 && Boolean(n.textContent?.trim())));
    }

    function renderIcon() {
      if (settings.noIcon) {
        iconBox.remove();
        return;
      }
      if (iconSlot) {
        if (iconSlot.parentElement !== iconBox) iconBox.prepend(iconSlot);
        if (iconFallback.parentElement !== iconBox) iconBox.append(iconFallback);
        const assigned = hasAssignedNodes(iconSlot);
        iconFallback.hidden = assigned;
        if (!assigned) {
          const markup = typeof settings.icon === "string" && settings.icon
            ? settings.icon
            : ALERT_ICONS[settings.severity];
          setHTML(iconFallback, markup);
        }
      } else if (typeof settings.icon === "object" && settings.icon) {
        iconBox.replaceChildren(settings.icon);
      } else {
        const markup = typeof settings.icon === "string" && settings.icon
          ? settings.icon
          : ALERT_ICONS[settings.severity];
        setHTML(iconBox, markup);
      }
      if (iconBox.parentElement !== root) root.prepend(iconBox);
    }

    function hasBodyContent(): boolean {
      if (settings.supportingText) return true;
      if (bodySlot) return hasAssignedNodes(bodySlot);
      if (typeof settings.content === "string") return settings.content.length > 0;
      if (settings.content) return true;
      return false;
    }

    function syncMultiline() {
      const hasLabel = Boolean(settings.label);
      const hasBody = hasBodyContent();
      root.classList.toggle(ALERT_CLASSES.MULTILINE, hasLabel && hasBody);
    }

    function renderContent() {
      renderSrSeverity();

      if (settings.label) {
        labelBox.textContent = settings.label;
        if (labelBox.parentElement !== contentBox) {
          if (srSeverity.parentElement === contentBox) srSeverity.after(labelBox);
          else contentBox.prepend(labelBox);
        }
      } else {
        labelBox.remove();
      }

      if (bodySlot) {
        if (bodySlot.parentElement !== supportingBox) supportingBox.prepend(bodySlot);
        if (supportingFallback.parentElement !== supportingBox) supportingBox.append(supportingFallback);
        const assigned = hasAssignedNodes(bodySlot);
        supportingFallback.textContent = assigned ? "" : (settings.supportingText ?? "");
        supportingFallback.hidden = assigned || !settings.supportingText;
        if (supportingBox.parentElement !== contentBox) contentBox.append(supportingBox);
        supportingBox.hidden = !hasBodyContent();
      } else if (settings.content !== undefined && settings.content !== "") {
        supportingBox.hidden = false;
        if (typeof settings.content === "string") setHTML(supportingBox, settings.content);
        else supportingBox.replaceChildren(settings.content);
        if (supportingBox.parentElement !== contentBox) contentBox.append(supportingBox);
      } else if (settings.supportingText) {
        supportingBox.hidden = false;
        supportingBox.textContent = settings.supportingText;
        if (supportingBox.parentElement !== contentBox) contentBox.append(supportingBox);
      } else {
        supportingBox.replaceChildren();
        supportingBox.remove();
      }

      if (contentBox.parentElement !== root) {
        if (iconBox.parentElement === root) iconBox.after(contentBox);
        else root.prepend(contentBox);
      }
      syncMultiline();
    }

    function renderActions() {
      const hasActionText = Boolean(settings.action);
      const slottedAction = hasAssignedNodes(actionSlot);
      const hasCustomAction = Boolean(settings.actionContent) && !actionSlot;

      if (actionSlot) {
        if (actionSlot.parentElement !== actionsBox) actionsBox.prepend(actionSlot);
        if (hasActionText && !slottedAction) {
          actionBtn.textContent = settings.action!;
          actionBtn.hidden = false;
          if (actionBtn.parentElement !== actionsBox) actionSlot.after(actionBtn);
        } else {
          actionBtn.remove();
        }
        if (settings.dismissible) {
          dismissBtn.setAttribute("aria-label", settings.dismissLabel || "Dismiss");
          setHTML(dismissBtn, getIcon("close", ALERT_ICONS.close));
          dismissBtn.hidden = false;
          if (dismissBtn.parentElement !== actionsBox) actionsBox.append(dismissBtn);
        } else {
          dismissBtn.remove();
        }
        if (actionsBox.parentElement !== root) root.append(actionsBox);
        actionsBox.hidden = !(hasActionText || slottedAction || settings.dismissible);
      } else {
        actionsBox.replaceChildren();
        if (hasCustomAction && settings.actionContent) {
          actionsBox.append(settings.actionContent);
        } else if (hasActionText && settings.action) {
          actionBtn.textContent = settings.action;
          actionsBox.append(actionBtn);
        }
        if (settings.dismissible) {
          dismissBtn.setAttribute("aria-label", settings.dismissLabel || "Dismiss");
          setHTML(dismissBtn, getIcon("close", ALERT_ICONS.close));
          actionsBox.append(dismissBtn);
        }
        if (hasActionText || hasCustomAction || settings.dismissible) {
          actionsBox.hidden = false;
          if (actionsBox.parentElement !== root) root.append(actionsBox);
        } else {
          actionsBox.remove();
        }
      }
    }

    function setupSlots() {
      bodySlot?.removeEventListener("slotchange", renderContent);
      iconSlot?.removeEventListener("slotchange", renderIcon);
      actionSlot?.removeEventListener("slotchange", renderActions);

      bodySlot = typeof settings.content === "object" && settings.content?.localName === "slot"
        ? settings.content as HTMLSlotElement
        : undefined;
      iconSlot = typeof settings.icon === "object" && settings.icon?.localName === "slot"
        ? settings.icon as HTMLSlotElement
        : undefined;
      actionSlot = typeof settings.actionContent === "object" && settings.actionContent?.localName === "slot"
        ? settings.actionContent as HTMLSlotElement
        : undefined;

      bodySlot?.addEventListener("slotchange", renderContent);
      iconSlot?.addEventListener("slotchange", renderIcon);
      actionSlot?.addEventListener("slotchange", renderActions);
    }

    root.classList.add(`${ALERT_CLASSES.ROOT}--${settings.variant}`, `${ALERT_CLASSES.ROOT}--${settings.severity}`);
    setupSlots();
    updateRole();
    renderIcon();
    renderContent();
    renderActions();

    return {
      ...component,
      element: root,
      setModifier,
      updateRole,
      renderSrSeverity,
      renderIcon,
      renderContent,
      renderActions,
      setupSlots,
      setDismissHandler(handler: (reason: AlertDismissReason) => void) {
        onDismissTrigger = handler;
      },
      destroy() {
        bodySlot?.removeEventListener("slotchange", renderContent);
        iconSlot?.removeEventListener("slotchange", renderIcon);
        actionSlot?.removeEventListener("slotchange", renderActions);
        actionBtn.removeEventListener("click", handleActionClick);
        dismissBtn.removeEventListener("click", handleDismissClick);
        root.remove();
        component.destroy();
      },
    };
  };
}
