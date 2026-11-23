import {
  defineElement,
  type DefineOptions,
  type ElementHost,
  type ElementInstance,
  type ElementSpec,
} from "material/elements";
import {
  ALERT_EVENTS,
  createAlert,
  type AlertActionEvent,
  type AlertBeforeDismissEvent,
  type AlertComponent,
  type AlertConfig,
  type AlertDismissEvent,
  type AlertDismissReason,
  type AlertSeverity,
} from "../components/alert";
import type { AlertController as Controller } from "../components/alert/alert";

function makeSlot(document: Document, name?: string): HTMLSlotElement {
  const slot = document.createElement("slot");
  if (name) slot.name = name;
  return slot;
}

const spec = {
  name: "alert",
  ssr: false,
  create: (config: Record<string, unknown>) => createAlert(config as AlertConfig) as Controller,
  styles: ["alert"],
  hostStyles: ":host{display:block}:host([hidden]),:host([no-open]){display:none}",
  attributes: {
    severity: {
      type: "string",
      config: "severity",
      update: (c: Controller, value: unknown) => void c.setSeverity(value == null ? "" : String(value)),
    },
    variant: {
      type: "string",
      config: "variant",
      update: (c: Controller, value: unknown) => void c.setVariant(value == null ? "" : String(value)),
    },
    label: {
      type: "string",
      config: "label",
      update: (c: Controller, value: unknown) => void c.setLabel(value == null ? undefined : String(value)),
    },
    "supporting-text": {
      type: "string",
      config: "supportingText",
      update: (c: Controller, value: unknown) => void c.setSupportingText(value == null ? undefined : String(value)),
    },
    icon: {
      type: "string",
      config: "icon",
      update: (c: Controller, value: unknown) => void c.setIcon(value == null ? undefined : String(value)),
    },
    "no-icon": {
      type: "boolean",
      config: "noIcon",
      update: (c: Controller, value: unknown) => void c.setNoIcon(Boolean(value)),
    },
    action: {
      type: "string",
      config: "action",
      update: (c: Controller, value: unknown) => void c.setAction(value == null ? undefined : String(value)),
    },
    dismissible: {
      type: "boolean",
      config: "dismissible",
      update: (c: Controller, value: unknown) => void c.setDismissible(Boolean(value)),
    },
    "dismiss-label": {
      type: "string",
      config: "dismissLabel",
      update: (c: Controller, value: unknown) => void c.setDismissLabel(value == null ? "Dismiss" : String(value)),
    },
    "severity-label": {
      type: "string",
      config: "severityLabel",
      update: (c: Controller, value: unknown) => void c.setSeverityLabel(value == null ? undefined : String(value)),
    },
    "no-open": {
      type: "boolean",
      update: (c: Controller, value: unknown, host: HTMLElement) => {
        if (value) c.dismiss("programmatic");
        else c.show();
        queueMicrotask(() => {
          host.toggleAttribute("no-open", !c.isOpen());
          host.toggleAttribute("hidden", !c.isOpen());
        });
      },
    },
    role: {
      type: "string",
      config: "role",
      update: (c: Controller, value: unknown) =>
        void c.setRole(value == null ? undefined : (String(value) as "alert" | "status" | "region")),
    },
  },
  properties: {
    open: {
      get: (c: Controller) => c.isOpen(),
      set: (c: Controller, value: unknown) => {
        if (value) c.show();
        else c.dismiss("programmatic");
      },
      config: "open",
    },
  },
  methods: [
    "show",
    "dismiss",
    "isOpen",
    "getSeverity",
    "setSeverity",
    "getVariant",
    "setVariant",
    "getLabel",
    "setLabel",
    "getSupportingText",
    "setSupportingText",
    "setIcon",
    "setNoIcon",
    "getAction",
    "setAction",
    "isDismissible",
    "setDismissible",
    "getDismissLabel",
    "setDismissLabel",
  ] as const,
  events: {
    action: {
      detail: (payload: unknown) => {
        const p = payload as AlertActionEvent;
        return { severity: p.severity, originalEvent: p.originalEvent };
      },
      state: true,
    },
    dismiss: {
      detail: (payload: unknown) => {
        const p = payload as AlertDismissEvent;
        return { severity: p.severity, reason: p.reason };
      },
      state: true,
    },
  },
  config(host: HTMLElement) {
    const doc = host.ownerDocument;
    const hasIconSlot = Array.from(host.children).some(child => child.getAttribute("slot") === "icon");
    const hasNoOpen = host.hasAttribute("no-open");
    return {
      content: makeSlot(doc),
      ...(hasIconSlot || !host.hasAttribute("icon") ? { icon: makeSlot(doc, "icon") } : {}),
      actionContent: makeSlot(doc, "action"),
      ...(hasNoOpen ? { open: false } : {}),
    };
  },
  setup(host: ElementHost<Controller>, component: Controller) {
    component.syncSlots();
    let syncing = false;
    const reflect = (isOpen: boolean) => {
      if (syncing) return;
      syncing = true;
      host.toggleAttribute("no-open", !isOpen);
      host.toggleAttribute("hidden", !isOpen);
      syncing = false;
    };
    const unsubscribe = component.onOpenStateChange(reflect);
    reflect(component.isOpen());

    const handleBeforeDismiss = (payload: AlertBeforeDismissEvent) => {
      const event = new CustomEvent("beforedismiss", {
        detail: { severity: payload.severity, reason: payload.reason },
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      host.dispatchEvent(event);
      if (event.defaultPrevented) payload.preventDefault();
    };
    component.on(ALERT_EVENTS.BEFORE_DISMISS, handleBeforeDismiss);

    return () => {
      unsubscribe();
      component.off(ALERT_EVENTS.BEFORE_DISMISS, handleBeforeDismiss);
    };
  },
} satisfies ElementSpec<Controller>;

export type AlertSpec = typeof spec;

export interface AlertElementEventMap {
  action: CustomEvent<AlertActionEvent>;
  beforedismiss: CustomEvent<{ severity: AlertSeverity; reason: AlertDismissReason }>;
  dismiss: CustomEvent<AlertDismissEvent>;
}

export const alertElementEventNames = ["action", "beforedismiss", "dismiss"] as const satisfies readonly (keyof AlertElementEventMap)[];

export type AlertElement = ElementInstance<AlertSpec, AlertComponent> & {
  open: boolean;
  show: () => AlertComponent;
  dismiss: (reason?: AlertDismissReason) => boolean;
};

const definition = defineElement<Controller>(spec);

export function defineAlert(options: DefineOptions = {}): string {
  return definition.define(options);
}

export const alertElement = {
  spec,
  get element() {
    return definition.element;
  },
  define: defineAlert,
};

declare global {
  interface HTMLElementTagNameMap {
    "m-alert": AlertElement;
  }
}
