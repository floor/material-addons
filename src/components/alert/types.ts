export type AlertSeverity = "info" | "success" | "warning" | "error";
export type AlertVariant = "tonal" | "outlined" | "filled";
export type AlertDismissReason = "button" | "programmatic";

export interface AlertActionEvent {
  severity: AlertSeverity;
  originalEvent: MouseEvent;
}

export interface AlertBeforeDismissEvent {
  severity: AlertSeverity;
  reason: AlertDismissReason;
  preventDefault: () => void;
  readonly defaultPrevented: boolean;
}

export interface AlertDismissEvent {
  severity: AlertSeverity;
  reason: AlertDismissReason;
}

export interface AlertEvents {
  action: (payload: AlertActionEvent) => void;
  beforedismiss: (payload: AlertBeforeDismissEvent) => void;
  dismiss: (payload: AlertDismissEvent) => void;
}

export interface AlertConfig {
  /** Semantic severity level. Determines palette, default icon, and role="status" vs role="alert". @default 'info' */
  severity?: AlertSeverity | string;
  /** Visual surface variant. @default 'tonal' */
  variant?: AlertVariant | string;
  /** Primary title / headline text. */
  label?: string;
  /** Secondary description text. */
  supportingText?: string;
  /** Rich HTML or element body content (used by <m-alert> default slot). */
  content?: string | HTMLElement;
  /** Custom leading icon markup. Defaults to the built-in severity icon. */
  icon?: string | HTMLElement;
  /** When true, hides the leading severity icon. @default false */
  noIcon?: boolean;
  /** Text label for the built-in action button, or custom action element/slot. */
  action?: string;
  actionContent?: HTMLElement;
  /** Whether a trailing dismiss icon button is rendered. @default false */
  dismissible?: boolean;
  /** Accessible label for the dismiss button. @default 'Dismiss' */
  dismissLabel?: string;
  /** Visually-hidden severity prefix for screen readers. Defaults to capitalized severity + ': '. Pass '' to omit. */
  severityLabel?: string;
  /** Whether the alert is initially open/visible. @default true */
  open?: boolean;
  /** Optional explicit ARIA role override ('alert' | 'status' | 'region'). Defaults to 'alert' for warning/error and 'status' for info/success. */
  role?: "alert" | "status" | "region";
  /** CSS classes. `className` is accepted as an alias for `class`. */
  class?: string;
  className?: string;
  componentName?: string;
  onAction?: AlertEvents["action"];
  onBeforeDismiss?: AlertEvents["beforedismiss"];
  onDismiss?: AlertEvents["dismiss"];
}

export interface AlertComponent {
  element: HTMLElement;
  getSeverity: () => AlertSeverity;
  setSeverity: (severity: AlertSeverity | string) => AlertComponent;
  getVariant: () => AlertVariant;
  setVariant: (variant: AlertVariant | string) => AlertComponent;
  getLabel: () => string | undefined;
  setLabel: (label: string | undefined) => AlertComponent;
  getSupportingText: () => string | undefined;
  setSupportingText: (supportingText: string | undefined) => AlertComponent;
  setIcon: (icon: string | HTMLElement | undefined) => AlertComponent;
  setNoIcon: (noIcon: boolean) => AlertComponent;
  getAction: () => string | undefined;
  setAction: (action: string | undefined) => AlertComponent;
  isDismissible: () => boolean;
  setDismissible: (dismissible: boolean) => AlertComponent;
  getDismissLabel: () => string;
  setDismissLabel: (label: string) => AlertComponent;
  isOpen: () => boolean;
  show: () => AlertComponent;
  dismiss: (reason?: AlertDismissReason) => boolean;
  on: <K extends keyof AlertEvents>(event: K, handler: AlertEvents[K]) => AlertComponent;
  off: <K extends keyof AlertEvents>(event: K, handler: AlertEvents[K]) => AlertComponent;
  destroy: () => void;
}
