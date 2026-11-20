import { defineElement, type DefineOptions, type ElementInstance, type ElementSpec } from "material/elements";
import { createRating, type RatingConfig } from "../components/rating";
import type { RatingController } from "../components/rating/types";
import { RATING_CLASSES } from "../components/rating/constants";

const validitySync = new WeakMap<RatingController, () => void>();

const spec = {
  name: "rating",
  ssr: false,
  create: (config: Record<string, unknown>) => createRating(config as RatingConfig) as RatingController,
  styles: ["rating"],
  hostStyles: ":host{display:inline-flex;vertical-align:top}",
  attributes: {
    value: {
      type: "number", config: "value",
      update: (c: RatingController, value: unknown) => c.setValue(typeof value === "number" ? value : 0),
    },
    max: { type: "number", config: "max", update: (c: RatingController, value: unknown) => c.setMax(typeof value === "number" ? value : 5) },
    half: { type: "boolean", config: "half", update: (c: RatingController, value: unknown) => c.setHalf(Boolean(value)) },
    "read-only": { type: "boolean", config: "readOnly", update: (c: RatingController, value: unknown) => c.setReadOnly(Boolean(value)) },
    disabled: { type: "boolean", config: "disabled", update: (c: RatingController, value: unknown) => c.setDisabled(Boolean(value)) },
    required: { type: "boolean", config: "required", update: (c: RatingController, value: unknown) => c.setRequired(Boolean(value)) },
    "no-clear": { type: "boolean", config: "noClear", update: (c: RatingController, value: unknown) => c.setNoClear(Boolean(value)) },
    size: { type: "string", config: "size", update: (c: RatingController, value: unknown) => c.setSize(value == null ? "medium" : String(value)) },
    label: { type: "string", config: "label", update: (c: RatingController, value: unknown) => c.setLabel(value == null ? undefined : String(value)) },
    "aria-label": { type: "string", config: "ariaLabel", update: (c: RatingController, value: unknown) => c.setAriaLabel(value == null ? undefined : String(value)) },
    "supporting-text": { type: "string", config: "supportingText", update: (c: RatingController, value: unknown) => c.setSupportingText(value == null ? undefined : String(value)) },
    error: { type: "boolean", config: "error", update: (c: RatingController, value: unknown) => c.setError(Boolean(value)) },
    "show-value": { type: "boolean", config: "showValue", update: (c: RatingController, value: unknown) => c.setShowValue(Boolean(value)) },
    icon: { type: "string", config: "icon", update: (c: RatingController, value: unknown) => c.setIcon(value == null ? undefined : String(value)) },
    "empty-icon": { type: "string", config: "emptyIcon", update: (c: RatingController, value: unknown) => c.setEmptyIcon(value == null ? undefined : String(value)) },
    name: { type: "string", config: "name", update: (c: RatingController, value: unknown) => c.setName(value == null ? undefined : String(value)) },
  },
  model: "value",
  properties: {
    value: {
      get: (c: RatingController) => c.getValue(),
      set: (c: RatingController, value: unknown) => c.setValue(typeof value === "number" ? value : Number(value) || 0),
      config: "value",
    },
  },
  methods: ["clear", "checkValidity", "reportValidity"] as const,
  events: {
    change: {
      detail: (payload: unknown) => {
        const event = payload as { value: number; previousValue: number };
        return { value: event.value, previousValue: event.previousValue };
      },
    },
    hover: {
      state: true,
      detail: (payload: unknown) => ({ value: (payload as { value: number | null }).value }),
    },
  },
  // The submitted value. An empty required rating is valueMissing on the first star.
  form: {
    value: (component: RatingController) => {
      validitySync.get(component)?.();
      return component.getValue() > 0 ? String(component.getValue()) : "";
    },
  },
  setup(host, component) {
    validitySync.set(component, () => {
      const internals = host.internals;
      if (!internals || typeof internals.setValidity !== "function") return;
      const missing = component.isRequired() && !component.isDisabled() && component.getValue() === 0;
      if (!missing) {
        internals.setValidity({});
        return;
      }
      const anchor = component.element.querySelector<HTMLElement>(`.${RATING_CLASSES.STOP}`);
      const message = "Please select a rating.";
      if (anchor) internals.setValidity({ valueMissing: true }, message, anchor);
      else internals.setValidity({ valueMissing: true }, message);
    });
    const move = () => {
      const field = component.element.querySelector<HTMLInputElement>(`.${RATING_CLASSES.INPUT}`);
      if (field && field.parentElement !== host) host.append(field);
    };
    move();
    const observer = new MutationObserver(move);
    observer.observe(component.element, { childList: true, subtree: true });
    return () => observer.disconnect();
  },
} satisfies ElementSpec<RatingController>;

export type RatingSpec = typeof spec;
export type RatingElementEventMap = {
  change: CustomEvent<{ value: number; previousValue: number }>;
  hover: CustomEvent<{ value: number | null }>;
};
export const ratingElementEventNames = Object.keys(spec.events) as (keyof RatingElementEventMap)[];

export interface RatingElement extends ElementInstance<RatingSpec, RatingController> {
  value: number;
  addEventListener<K extends keyof RatingElementEventMap>(type: K, listener: (this: RatingElement, event: RatingElementEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof RatingElementEventMap>(type: K, listener: (this: RatingElement, event: RatingElementEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
  removeEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
}

declare global {
  interface HTMLElementTagNameMap { "m-rating": RatingElement }
}

export const ratingElement = defineElement<RatingController>(spec);

export function defineRating(options: DefineOptions = {}): string {
  return ratingElement.define(options);
}
