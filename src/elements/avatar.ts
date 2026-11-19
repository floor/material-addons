import { defineElement, type DefineOptions, type ElementHost, type ElementInstance, type ElementSpec } from "material/elements";
import { createAvatarController } from "../components/avatar/avatar";
import type { AvatarBadgeConfig, AvatarConfig } from "../components/avatar";

type Controller = ReturnType<typeof createAvatarController>;
type AvatarHost = ElementHost<Controller>;
type Listener = EventListenerOrEventListenerObject;
interface ClickSubscription {
  listener: Listener;
  capture: boolean;
  remove(): void;
}

const subscriptions = new WeakMap<AvatarHost, ClickSubscription[]>();

function readBadge(host: HTMLElement): AvatarBadgeConfig | undefined {
  if (!host.hasAttribute("badge")) return;
  return {
    variant: host.getAttribute("badge-variant") ?? "small",
    label: host.getAttribute("badge-label") ?? undefined,
    color: host.getAttribute("badge-color") ?? undefined,
  };
}

function updateBadge(component: Controller, _value: unknown, host: HTMLElement) {
  component.setBadge(readBadge(host));
}

const spec = {
  name: "avatar",
  ssr: false,
  create: (config: Record<string, unknown>) => createAvatarController(config as AvatarConfig),
  styles: ["badge", "avatar"],
  hostStyles: ":host{display:inline-flex}",
  attributes: {
    variant: { type: "string", config: "variant", update: (c: Controller, value: unknown) => c.setVariant(String(value)) },
    size: { type: "string", config: "size", update: (c: Controller, value: unknown) => c.setSize(String(value)) },
    shape: { type: "string", config: "shape", update: (c: Controller, value: unknown) => c.setShape(String(value)) },
    text: { type: "string", config: "text", update: (c: Controller, value: unknown) => c.setText(value == null ? "" : String(value)) },
    label: { type: "string", config: "label", update: (c: Controller, value: unknown) => c.setLabel(value == null ? undefined : String(value)) },
    "supporting-text": { type: "string", config: "supportingText", update: (c: Controller, value: unknown) => c.setSupportingText(value == null ? undefined : String(value)) },
    disabled: { type: "boolean", config: "disabled", update: (c: Controller, value: unknown) => c.setDisabled(Boolean(value)) },
    placement: { type: "string", config: "placement", update: (c: Controller, value: unknown) => c.setPlacement(String(value)) },
    badge: { type: "boolean", update: updateBadge },
    "badge-variant": { type: "string", update: updateBadge },
    "badge-label": { type: "string", update: updateBadge },
    "badge-color": { type: "string", update: updateBadge },
    "aria-label": { type: "string", config: "ariaLabel", update: (c: Controller, value: unknown) => c.setAriaLabel(value == null ? undefined : String(value)) },
    decorative: { type: "boolean", config: "decorative", update: (c: Controller, value: unknown) => c.setDecorative(Boolean(value)) },
    href: { type: "string", config: "href" },
    target: { type: "string", config: "target" },
    rel: { type: "string", config: "rel" },
  },
  config(host) {
    return { content: host.ownerDocument.createElement("slot"), badge: readBadge(host) };
  },
  setup(host, component) {
    if (subscriptions.get(host)?.length) component.setInteractive(true);
  },
} satisfies ElementSpec<Controller>;

export type AvatarSpec = typeof spec;
export type AvatarElementEventMap = { click: MouseEvent };
export type AvatarElement = ElementInstance<AvatarSpec, Controller>;

const definition = defineElement<Controller>(spec);
let prepared = false;

// Track direct host click listeners on this element class so an avatar can
// use a native button only while it has an activation handler.
function prepareElement() {
  const ctor = definition.element;
  if (prepared) return ctor;
  prepared = true;
  const proto = ctor.prototype as AvatarHost;
  const add = proto.addEventListener;
  const remove = proto.removeEventListener;
  proto.addEventListener = function (this: AvatarHost, type: string, listener: Listener | null, options?: boolean | AddEventListenerOptions) {
    if (!listener) return;
    if (type !== "click") {
      add.call(this, type, listener, options);
      return;
    }
    const opts = typeof options === "object" ? options : {};
    if (opts.signal?.aborted) return;
    const capture = typeof options === "boolean" ? options : Boolean(opts.capture);
    let entries = subscriptions.get(this);
    if (!entries) subscriptions.set(this, entries = []);
    if (entries.some(entry => entry.listener === listener && entry.capture === capture)) return;

    const finish = () => {
      const index = entries.indexOf(entry);
      if (index < 0) return;
      entries.splice(index, 1);
      remove.call(this, type, wrapped, capture);
      opts.signal?.removeEventListener("abort", finish);
      if (!entries.length) this.component?.setInteractive(false);
    };
    const wrapped = (event: Event) => {
      if (opts.once) {
        // Let a once listener re-register itself while matching native order.
        entries.splice(entries.indexOf(entry), 1);
        opts.signal?.removeEventListener("abort", finish);
      }
      try {
        if (typeof listener === "function") listener.call(this, event);
        else listener.handleEvent(event);
      } finally {
        if (opts.once && !entries.length) this.component?.setInteractive(false);
      }
    };
    const entry = { listener, capture, remove: finish };
    add.call(this, type, wrapped, options);
    entries.push(entry);
    opts.signal?.addEventListener("abort", finish, { once: true });
    if (entries.length === 1) this.component?.setInteractive(true);
  };
  proto.removeEventListener = function (this: AvatarHost, type: string, listener: Listener | null, options?: boolean | EventListenerOptions) {
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    const entry = type === "click" && subscriptions.get(this)?.find(item => item.listener === listener && item.capture === capture);
    if (entry) entry.remove();
    else if (listener) remove.call(this, type, listener, options);
  };
  return ctor;
}

export function defineAvatar(options: DefineOptions = {}): string {
  prepareElement();
  return definition.define(options);
}

export const avatarElement = { spec, get element() { return prepareElement(); }, define: defineAvatar };

declare global {
  interface HTMLElementTagNameMap {
    "m-avatar": AvatarElement;
  }
}
