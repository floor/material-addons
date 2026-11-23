export const ALERT_SEVERITIES = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
} as const;

export const ALERT_VARIANTS = {
  TONAL: "tonal",
  OUTLINED: "outlined",
  FILLED: "filled",
} as const;

export const ALERT_EVENTS = {
  ACTION: "action",
  BEFORE_DISMISS: "beforedismiss",
  DISMISS: "dismiss",
} as const;

export const ALERT_CLASSES = {
  ROOT: "mtrl-alert",
  ICON: "mtrl-alert__icon",
  CONTENT: "mtrl-alert__content",
  SR_SEVERITY: "mtrl-alert__sr-severity",
  LABEL: "mtrl-alert__label",
  SUPPORTING_TEXT: "mtrl-alert__supporting-text",
  ACTIONS: "mtrl-alert__actions",
  ACTION: "mtrl-alert__action",
  DISMISS: "mtrl-alert__dismiss",
  MULTILINE: "mtrl-alert--multiline",
  CLOSED: "mtrl-alert--closed",
} as const;

export const ALERT_DEFAULTS = {
  SEVERITY: ALERT_SEVERITIES.INFO,
  VARIANT: ALERT_VARIANTS.TONAL,
  NO_ICON: false,
  DISMISSIBLE: false,
  DISMISS_LABEL: "Dismiss",
  OPEN: true,
} as const;

export const ALERT_ICONS = {
  info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M11 7h2v2h-2V7zm0 4h2v6h-2v-6zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>',
  success: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8-1.41-1.42z"/></svg>',
  warning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M1 21h22L12 2 1 21zm3.47-2L12 5.99 19.53 19H4.47zM11 16h2v2h-2v-2zm0-6h2v4h-2v-4z"/></svg>',
  error: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M11 15h2v2h-2v-2zm0-8h2v6h-2V7zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>',
  close: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>',
} as const;
