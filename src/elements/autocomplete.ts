import { defineElement, type AttributeSpec, type DefineOptions, type ElementHost, type ElementInstance, type ElementSpec } from "material/elements";
import { createAutocomplete, type AutocompleteComponent, type AutocompleteConfig, type AutocompleteEvents, type AutocompleteOption } from "../components/autocomplete";

const optionAttributes = {
  value: { type: "string" },
  label: { type: "string" },
  "supporting-text": { type: "string" },
  icon: { type: "string" },
  disabled: { type: "boolean" },
} as const;

export const autocompleteOptionDeclaration = {
  name: "autocomplete-option", attributes: optionAttributes,
} as const;

const signatures = new WeakMap<HTMLElement, string>();
type AttributeValue = Parameters<NonNullable<AttributeSpec<AutocompleteComponent>["update"]>>[1];
function readOptions(host: HTMLElement): AutocompleteOption[] {
  return Array.from(host.children)
    .filter(child => child.localName === `${host.localName}-option`)
    .map(child => {
      const text = child.getAttribute("label") ?? child.textContent?.trim() ?? "";
      return {
        text, value: child.getAttribute("value") ?? text,
        supportingText: child.getAttribute("supporting-text") ?? undefined,
        icon: child.getAttribute("icon") ?? undefined,
        disabled: child.hasAttribute("disabled"),
      };
    });
}

const spec = {
  name: "autocomplete",
  ssr: false,
  create: (config: Record<string, unknown>) => createAutocomplete(config as AutocompleteConfig),
  styles: ["text-field", "listbox", "autocomplete"],
  hostStyles: ":host{display:inline-flex}:host>:first-child{width:100%}",
  attributes: {
    variant: { type: "string", config: "variant" },
    density: { type: "string", config: "density" },
    label: { type: "string", config: "label" },
    placeholder: { type: "string", config: "placeholder" },
    value: { type: "string", config: "value", update: (c: AutocompleteComponent, value: AttributeValue) => c.setValue(value as string | null) },
    name: { type: "string", update: () => {} },
    placement: { type: "string", config: "placement" },
    "max-height": { type: "string", config: "maxHeight" },
    "supporting-text": { type: "string", config: "supportingText" },
    error: { type: "boolean", config: "error" },
    required: { type: "boolean", config: "required" },
    "no-asterisk": { type: "boolean", config: "noAsterisk" },
    disabled: {
      type: "boolean", config: "disabled",
      update: (c: AutocompleteComponent, value: AttributeValue, host: HTMLElement) =>
        value || host.matches(":disabled") ? c.disable() : c.enable(),
    },
    readonly: { type: "boolean", config: "readonly" },
    strict: { type: "boolean", config: "strict" },
    "auto-highlight": { type: "boolean", config: "autoHighlight" },
    "no-open-on-focus": { type: "boolean" },
    "no-clearable": { type: "boolean" },
    "no-highlight-match": { type: "boolean" },
    "min-length": { type: "number", config: "minLength" },
    debounce: { type: "number", config: "debounce" },
    "empty-text": { type: "string", config: "emptyText" },
    "loading-text": { type: "string", config: "loadingText" },
    "leading-icon": { type: "string", config: "leadingIcon" },
    "trailing-icon": { type: "string", config: "trailingIcon" },
    "trailing-label": { type: "string", config: "trailingIconLabel" },
    "prefix-text": { type: "string", config: "prefixText" },
    "suffix-text": { type: "string", config: "suffixText" },
    "aria-label": { type: "string", config: "ariaLabel" },
  },
  model: "value",
  properties: {
    value: { get: c => c.getValue(), set: (c, value) => c.setValue(value == null ? null : String(value)), config: "value" },
  },
  methods: ["open", "close", "toggle", "clear", "getText", "getSelectedOption", "getOptions", "setOptions"] as const,
  events: { input: {}, select: {}, change: {}, clear: {}, open: { state: true }, close: { state: true } },
  form: {
    value: c => c.getValue(),
    control: c => c.textField.input,
    activate: c => c.textField.input.focus(),
    state: c => c.getValue() ?? "",
    restore: (c, value) => c.setValue(value || null),
    disable: (c, disabled) => disabled ? c.disable() : c.enable(),
  },
  config(host) {
    const options = readOptions(host);
    signatures.set(host, JSON.stringify(options));
    return {
      options,
      openOnFocus: !host.hasAttribute("no-open-on-focus"),
      clearable: !host.hasAttribute("no-clearable"),
      highlightMatch: !host.hasAttribute("no-highlight-match"),
    };
  },
  observeChildren(host: ElementHost<AutocompleteComponent>, component: AutocompleteComponent) {
    const options = readOptions(host);
    const signature = JSON.stringify(options);
    if (signature !== signatures.get(host)) {
      signatures.set(host, signature);
      component.setOptions(options);
    }
    return true;
  },
  setup(_host: ElementHost<AutocompleteComponent>, component: AutocompleteComponent) {
    component.element.after(component.listbox);
    const input = component.textField.input;
    // The factory's mapped events are the host's public events.
    const stop = (event: Event) => event.stopPropagation();
    input.addEventListener("input", stop);
    input.addEventListener("change", stop);
    return () => {
      input.removeEventListener("input", stop);
      input.removeEventListener("change", stop);
    };
  },
} satisfies ElementSpec<AutocompleteComponent>;

export type AutocompleteSpec = typeof spec;
export type AutocompleteElementEventMap = {
  [K in keyof AutocompleteEvents]: CustomEvent<Parameters<AutocompleteEvents[K]>[0]>;
};
export const autocompleteElementEventNames = Object.keys(spec.events) as (keyof AutocompleteElementEventMap)[];
export type AutocompleteOptionAttributes = import("material/elements").ElementAttributes<typeof autocompleteOptionDeclaration>;
export interface AutocompleteElement extends ElementInstance<AutocompleteSpec, AutocompleteComponent> {
  value: string | null;
  addEventListener<K extends keyof AutocompleteElementEventMap>(type: K, listener: (this: AutocompleteElement, event: AutocompleteElementEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof AutocompleteElementEventMap>(type: K, listener: (this: AutocompleteElement, event: AutocompleteElementEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
  removeEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "m-autocomplete": AutocompleteElement;
    "m-autocomplete-option": HTMLElement & AutocompleteOptionAttributes;
  }
}
export const autocompleteElement = defineElement<AutocompleteComponent>(spec);

export function defineAutocomplete(options: DefineOptions = {}): string {
  const tag = `${options.prefix ?? "m"}-${autocompleteOptionDeclaration.name}`;
  if (!customElements.get(tag)) {
    // Material exports the client factory wrapper, but its declaration class
    // creator is internal. Reflect the option's small public attribute surface.
    const attributes = Object.entries(optionAttributes).map(([attribute, { type }]) => ({
      attribute, type, property: attribute.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase()),
    }));
    class AutocompleteOptionElement extends HTMLElement {
      connectedCallback() {
        const self = this as unknown as Record<string, unknown>;
        for (const { property } of attributes) {
          if (!Object.hasOwn(self, property)) continue;
          const value = self[property];
          delete self[property];
          self[property] = value;
        }
      }
    }
    for (const { attribute, type, property } of attributes) {
      Object.defineProperty(AutocompleteOptionElement.prototype, property, {
        get(this: HTMLElement) { return type === "boolean" ? this.hasAttribute(attribute) : this.getAttribute(attribute); },
        set(this: HTMLElement, value: unknown) {
          if (type === "boolean") this.toggleAttribute(attribute, !!value);
          else if (value == null) this.removeAttribute(attribute);
          else this.setAttribute(attribute, String(value));
        },
      });
    }
    customElements.define(tag, AutocompleteOptionElement);
  }
  return autocompleteElement.define(options);
}
