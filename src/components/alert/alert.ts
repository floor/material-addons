import { createBase, pipe, withElement, withEvents } from "material/core/compose";
import { alertSettings, getElementConfig, option } from "./config";
import { ALERT_DEFAULTS, ALERT_SEVERITIES, ALERT_VARIANTS } from "./constants";
import { withDismiss } from "./features/withDismiss";
import { withRenderer } from "./features/withRenderer";
import type { AlertComponent, AlertConfig, AlertDismissReason, AlertEvents } from "./types";

function createAlertController(config: AlertConfig = {}) {
  const settings = alertSettings(config);
  const base = pipe(
    createBase,
    withEvents(),
    withElement(getElementConfig(settings)),
  )({ componentName: "alert", ...config });
  const rendered = withRenderer(settings)(base);
  const composed = withDismiss(settings)(rendered);

  const alert: AlertComponent = {
    get element() {
      return composed.element;
    },
    getSeverity: () => settings.severity,
    setSeverity(value) {
      composed.setModifier("severity", option(ALERT_SEVERITIES, value, ALERT_DEFAULTS.SEVERITY));
      composed.updateRole();
      composed.renderSrSeverity();
      composed.renderIcon();
      return this;
    },
    getVariant: () => settings.variant,
    setVariant(value) {
      composed.setModifier("variant", option(ALERT_VARIANTS, value, ALERT_DEFAULTS.VARIANT));
      return this;
    },
    getLabel: () => settings.label,
    setLabel(value) {
      settings.label = value;
      composed.renderContent();
      return this;
    },
    getSupportingText: () => settings.supportingText,
    setSupportingText(value) {
      settings.supportingText = value;
      composed.renderContent();
      return this;
    },
    setIcon(value) {
      settings.icon = value;
      composed.setupSlots();
      composed.renderIcon();
      return this;
    },
    setNoIcon(value) {
      settings.noIcon = Boolean(value);
      composed.renderIcon();
      return this;
    },
    getAction: () => settings.action,
    setAction(value) {
      settings.action = value;
      composed.renderActions();
      return this;
    },
    isDismissible: () => settings.dismissible,
    setDismissible(value) {
      settings.dismissible = Boolean(value);
      composed.renderActions();
      return this;
    },
    getDismissLabel: () => settings.dismissLabel,
    setDismissLabel(value) {
      settings.dismissLabel = value || ALERT_DEFAULTS.DISMISS_LABEL;
      composed.renderActions();
      return this;
    },
    isOpen: () => composed.isOpen(),
    show() {
      composed.show();
      return this;
    },
    dismiss(reason?: AlertDismissReason) {
      return composed.dismiss(reason);
    },
    on<K extends keyof AlertEvents>(event: K, handler: AlertEvents[K]) {
      composed.on?.(event, handler as never);
      return this;
    },
    off<K extends keyof AlertEvents>(event: K, handler: AlertEvents[K]) {
      composed.off?.(event, handler as never);
      return this;
    },
    destroy() {
      composed.destroy();
    },
  };

  return Object.assign(alert, {
    setSeverityLabel(value: string | undefined) {
      settings.severityLabel = value;
      composed.renderSrSeverity();
      return alert;
    },
    getSeverityLabel: () => settings.severityLabel,
    setRole(value: "alert" | "status" | "region" | undefined) {
      settings.role = value;
      composed.updateRole();
      return alert;
    },
    syncSlots() {
      composed.renderIcon();
      composed.renderContent();
      composed.renderActions();
    },
    onOpenStateChange: composed.onOpenStateChange,
  });
}

export type AlertController = ReturnType<typeof createAlertController>;

/** Creates an inline semantic status or severity alert callout with optional action and vetoable dismiss. */
export const createAlert: (config?: AlertConfig) => AlertComponent = createAlertController;
