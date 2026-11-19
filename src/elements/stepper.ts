// src/elements/stepper.ts
/**
 * `<m-stepper>` with `<m-step>` children.
 *
 * Each `<m-step>` is one step: its attributes declare the step, and its
 * children are the step's content, shown in the matching panel. The children
 * stay in the light DOM where the framework put them; the element assigns each
 * one a slot and the panel takes the slot, so nothing moves and no `order` is
 * written.
 *
 * Client only: server rendering of the element is deferred until `material`'s
 * renderer accepts another package's specs.
 *
 * @module elements
 */

import {
  DEFAULT_PREFIX,
  defineElement,
  type DefineOptions,
  type ElementSpec,
} from "material/elements";
import createStepper from "../components/stepper";
import type { StepConfig, StepState, StepperComponent, StepperConfig, StepperOrientation } from "../components/stepper/types";

/** The tag of the step declaration for a stepper host: `<m-stepper>` reads `<m-step>`. */
const stepTagOf = (host: HTMLElement): string => host.localName.replace(/stepper$/, "step");

/** The slot a step's content is taken through: `step-0`, `step-1`, … */
const slotOf = (index: number): string => `step-${index}`;

/** One step, as its declaration attributes read; no content. */
const readStep = (child: HTMLElement): StepConfig => {
  const value = child.getAttribute("value") ?? undefined;
  const supportingText = child.getAttribute("supporting-text") ?? undefined;
  const icon = child.getAttribute("icon") ?? undefined;
  return {
    value,
    label: child.getAttribute("label") ?? "",
    supportingText,
    icon,
    completed: child.hasAttribute("completed"),
    // `no-edit` is the presence opt-out: editable is the default
    editable: !child.hasAttribute("no-edit"),
    optional: child.hasAttribute("optional"),
    error: child.hasAttribute("error"),
    disabled: child.hasAttribute("disabled"),
  };
};

/** The declared steps, with each child's content slot named. */
const declaredSteps = (host: HTMLElement): StepConfig[] => {
  const stepTag = stepTagOf(host);
  const steps: StepConfig[] = [];
  for (const child of Array.from(host.children) as HTMLElement[]) {
    if (child.localName !== stepTag) continue;
    const index = steps.length;
    const slot = slotOf(index);
    if (child.getAttribute("slot") !== slot) child.setAttribute("slot", slot);
    const step = readStep(child);
    step.content = (body: HTMLElement) => {
      const target = document.createElement("slot");
      target.name = slot;
      body.appendChild(target);
    };
    steps.push(step);
  }
  return steps;
};

/** What the declarations say, without the content closures a read makes. */
const digest = (host: HTMLElement): string => {
  const stepTag = stepTagOf(host);
  return JSON.stringify(
    (Array.from(host.children) as HTMLElement[])
      .filter((child) => child.localName === stepTag)
      .map((child) => readStep(child)),
  );
};

/** What the element last built from, so a child mutation compares against it. */
const authored = new WeakMap<HTMLElement, string>();

const camel = (name: string): string => name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

const stepperSpec = {
  name: "stepper",
  ssr: false,
  styles: ["stepper"],
  hostStyles: ":host{display:block;contain:layout}",
  create: (config) => {
    const component = createStepper(config as StepperConfig);
    return component;
  },
  attributes: {
    value: { type: "string", config: "value", update: (c, value) => void c.setValue(value === null ? null : String(value)) },
    orientation: {
      type: "string",
      config: "orientation",
      update: (c, value) => {
        if (value !== null) c.setOrientation(value as StepperOrientation);
      },
    },
    "auto-breakpoint": { type: "number", config: "autoBreakpoint" },
    linear: { type: "boolean", config: "linear", update: (c, value) => void c.setLinear(!!value) },
    "label-placement": { type: "string", config: "labelPlacement" },
    "header-placement": { type: "string", config: "headerPlacement" },
    // The opt-out reaches the factory through `config(host)`; a change rebuilds
    "no-report-validity": { type: "boolean" },
    "optional-supporting-text": { type: "string", config: "optionalSupportingText" },
    "aria-label": {
      type: "string",
      config: "ariaLabel",
      update: (c, value) => c.element.setAttribute("aria-label", value === null ? "Progress" : String(value)),
    },
    disabled: { type: "boolean", config: "disabled", update: (c, value) => void (value ? c.disable() : c.enable()) },
  },
  properties: {
    value: { get: (c) => c.getValue(), set: (c, value) => void c.setValue(value === null || value === undefined ? null : String(value)), config: "value" },
  },
  model: "value" as const,
  methods: [
    "next",
    "prev",
    "goTo",
    "reset",
    "validate",
    "getValue",
    "setValue",
    "getActiveStep",
    "getActiveIndex",
    "getStep",
    "getSteps",
    "completeStep",
    "setError",
    "setStepState",
    "addStep",
    "removeStep",
    "setOrientation",
    "getResolvedOrientation",
    "setLinear",
    "enable",
    "disable",
    "isDisabled",
  ] as const,
  events: {
    change: {},
    complete: {},
    reset: {},
    // A layout change is a state of the element, not of its value
    orientationchange: { state: true },
    // `error` is bridged in setup as `validationerror`: any DOM event named
    // `error`, bubbling or not, reaches every window capture listener (a page's
    // monitoring, a dev overlay) as if the page had thrown.
  },
  config: (host: HTMLElement) => {
    const steps = declaredSteps(host);
    authored.set(host, digest(host));
    return { steps, reportValidity: !host.hasAttribute("no-report-validity") };
  },
  observeChildren: (host: HTMLElement, component: StepperComponent): boolean => {
    const next = digest(host);
    if (authored.get(host) !== next) {
      authored.set(host, next);
      component.setSteps(declaredSteps(host));
    }
    return true;
  },
  setup: (host, component) => {
    // The factory's cancelling beforechange becomes a cancelable DOM event
    const onBeforeChange = (payload: unknown): void => {
      const event = new CustomEvent("beforechange", { detail: payload, bubbles: true, composed: true, cancelable: true });
      host.dispatchEvent(event);
      if (event.defaultPrevented) (payload as { preventDefault: () => void }).preventDefault();
    };
    // A failed validation, under a name that is not the page's error channel
    const onError = (payload: unknown): void => {
      host.dispatchEvent(new CustomEvent("validationerror", { detail: payload, bubbles: true, composed: true }));
    };
    component.on("beforechange", onBeforeChange);
    component.on("error", onError);
    return () => {
      component.off("beforechange", onBeforeChange);
      component.off("error", onError);
    };
  },
} satisfies ElementSpec<StepperComponent>;

export const stepperElement = defineElement<StepperComponent>(stepperSpec);

/**
 * `<m-stepper>` as a ref or a query returns it: its attributes and live
 * properties, and the factory methods it forwards.
 */
export type StepperElement = HTMLElement & {
  component: StepperComponent | null;
  readonly dirty: boolean;
  value: string | null;
  orientation: string | null;
  autoBreakpoint: number | null;
  linear: boolean;
  labelPlacement: string | null;
  headerPlacement: string | null;
  noReportValidity: boolean;
  optionalSupportingText: string | null;
  disabled: boolean;
  next: () => Promise<boolean>;
  prev: () => Promise<boolean>;
  goTo: (target: number | string) => Promise<boolean>;
  reset: () => StepperComponent;
  validate: (target?: number | string) => Promise<boolean>;
  getValue: () => string | null;
  setValue: (value: string | null) => StepperComponent;
  getActiveStep: () => StepState | null;
  getActiveIndex: () => number;
  getStep: (target: number | string) => StepState | null;
  getSteps: () => StepState[];
  completeStep: (target?: number | string, completed?: boolean) => StepperComponent;
  setError: (target: number | string, error: boolean, supportingText?: string) => StepperComponent;
  setStepState: (
    target: number | string,
    patch: Partial<Pick<StepConfig, "label" | "supportingText" | "icon" | "completed" | "editable" | "optional" | "error" | "disabled">>,
  ) => StepperComponent;
  addStep: (step: StepConfig, index?: number) => StepperComponent;
  removeStep: (target: number | string) => StepperComponent;
  setOrientation: (orientation: StepperOrientation) => StepperComponent;
  getResolvedOrientation: () => "horizontal" | "vertical";
  setLinear: (linear: boolean) => StepperComponent;
  enable: () => StepperComponent;
  disable: () => StepperComponent;
  isDisabled: () => boolean;
};

/**
 * `<m-step>` declares one step and renders nothing itself: its children are
 * taken through the slot `<m-stepper>` places for it.
 *
 * `material` does not export `createDeclarationClass` from its public
 * `material/elements` entry, so the same small class is written here: a
 * property set before the definition lands on the attribute the element reads.
 */
export const stepDeclaration = {
  name: "step",
  attributes: {
    value: { type: "string" },
    label: { type: "string" },
    "supporting-text": { type: "string" },
    icon: { type: "string" },
    completed: { type: "boolean" },
    "no-edit": { type: "boolean" },
    optional: { type: "boolean" },
    error: { type: "boolean" },
    disabled: { type: "boolean" },
  },
} as const;
export type StepAttributes = {
  value: string | null;
  label: string | null;
  supportingText: string | null;
  icon: string | null;
  completed: boolean;
  noEdit: boolean;
  optional: boolean;
  error: boolean;
  disabled: boolean;
};

/** The declaration class, built on first definition: nothing here runs on a server. */
const stepClass = (): CustomElementConstructor => {
  const attributes = stepDeclaration.attributes;
  class StepDeclaration extends HTMLElement {}
  for (const [name, attribute] of Object.entries(attributes)) {
    Object.defineProperty(StepDeclaration.prototype, camel(name), {
      configurable: true,
      get(this: HTMLElement) {
        return attribute.type === "boolean" ? this.hasAttribute(name) : this.getAttribute(name);
      },
      set(this: HTMLElement, value: unknown) {
        if (attribute.type === "boolean") this.toggleAttribute(name, value !== false && value !== null && value !== undefined);
        else if (value === null || value === undefined) this.removeAttribute(name);
        else this.setAttribute(name, String(value));
      },
    });
  }
  return StepDeclaration;
};

/** Registers `<m-stepper>` and `<m-step>` (or with another prefix). */
export const defineStepper = (options?: DefineOptions): string => {
  const stepTag = `${options?.prefix ?? DEFAULT_PREFIX}-${stepDeclaration.name}`;
  // The declaration first: steps already in the page upgrade before the
  // stepper reads them, as the tabs' `<m-tab>` children do.
  if (!customElements.get(stepTag)) customElements.define(stepTag, stepClass());
  return stepperElement.define(options);
};

declare global {
  /** `document.querySelector("m-…")` and `createElement` return the element's type (the default prefix). */
  interface HTMLElementTagNameMap {
    "m-stepper": StepperElement;
    "m-step": HTMLElement & StepAttributes;
  }
}
