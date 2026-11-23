import { ALERT_CLASSES, ALERT_DEFAULTS, ALERT_SEVERITIES, ALERT_VARIANTS } from "./constants";
import type { AlertConfig } from "./types";

export function option<T extends string>(values: Record<string, T>, value: string | undefined, fallback: T): T {
  return Object.values(values).find(candidate => candidate === value) ?? fallback;
}

export function getElementConfig(config: AlertConfig) {
  return {
    tag: "div",
    className: [ALERT_CLASSES.ROOT, config.class ?? config.className ?? ""],
  };
}

export function alertSettings(config: AlertConfig) {
  return {
    ...config,
    severity: option(ALERT_SEVERITIES, config.severity, ALERT_DEFAULTS.SEVERITY),
    variant: option(ALERT_VARIANTS, config.variant, ALERT_DEFAULTS.VARIANT),
    noIcon: config.noIcon ?? ALERT_DEFAULTS.NO_ICON,
    dismissible: config.dismissible ?? ALERT_DEFAULTS.DISMISSIBLE,
    dismissLabel: config.dismissLabel ?? ALERT_DEFAULTS.DISMISS_LABEL,
    open: config.open ?? ALERT_DEFAULTS.OPEN,
  };
}

export type AlertSettings = ReturnType<typeof alertSettings>;
