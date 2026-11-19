// test/stepper-element.test.ts

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import * as sass from "sass";
import "material/elements/css/ripple";
import { hasStyles, registerStyles } from "material/elements";
import { defineStepper, stepDeclaration, stepperElement } from "../src/elements/stepper";

let dom: JSDOM;
const originalGlobals = new Map<string, PropertyDescriptor | undefined>();
const originalNodeEnv = process.env.NODE_ENV;

beforeAll(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLButtonElement: dom.window.HTMLButtonElement,
    HTMLFormElement: dom.window.HTMLFormElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node,
    CustomEvent: dom.window.CustomEvent,
    KeyboardEvent: dom.window.KeyboardEvent,
    MouseEvent: dom.window.MouseEvent,
    MutationObserver: dom.window.MutationObserver,
    ShadowRoot: dom.window.ShadowRoot,
    customElements: (dom.window as unknown as { customElements: CustomElementRegistry }).customElements,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  };
  for (const [name, value] of Object.entries(globals)) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  }
  // The shadow sheet an element adopts is the component's compiled Sass
  registerStyles({
    stepper: sass.compile("src/styles/components/_stepper.scss", {
      loadPaths: ["node_modules"],
      style: "compressed",
      logger: sass.Logger.silent,
    }).css,
  });
  defineStepper();
});

afterAll(() => {
  dom.window.close();
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

beforeEach(() => {
  document.body.replaceChildren();
});

const markup = (attributes = "") => `
  <m-stepper ${attributes}>
    <m-step value="account" label="Account details" supporting-text="Name and email">
      <input id="first" required>
      <div slot="actions"><button data-stepper-next>Continue</button></div>
    </m-step>
    <m-step value="address" label="Shipping address" optional><p>Where</p></m-step>
    <m-step value="review" label="Review" no-edit><p>Done</p></m-step>
  </m-stepper>
`;

type StepperHost = HTMLElement & {
  value: string | null;
  next: () => Promise<boolean>;
  prev: () => Promise<boolean>;
  goTo: (target: number | string) => Promise<boolean>;
  getSteps: () => Array<{ value: string; label: string; completed: boolean; editable: boolean; error: boolean; optional: boolean }>;
  getResolvedOrientation: () => string;
  orientation: string | null;
  linear: boolean;
  disabled: boolean;
};

const mount = (attributes = ""): StepperHost => {
  document.body.innerHTML = markup(attributes);
  const host = document.querySelector("m-stepper") as unknown as StepperHost;
  return host;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const steps = (host: StepperHost) => Array.from(host.children).filter((child) => child.localName === "m-step");

const shadow = (host: HTMLElement) => host.shadowRoot as ShadowRoot;

describe("<m-stepper> and <m-step>", () => {
  test("the defineElement contract: the spec the element was built from", () => {
    const stepperSpec = stepperElement.spec;
    expect(stepperSpec.name).toBe("stepper");
    // Server rendering is deferred until material's renderer takes external specs
    expect(stepperSpec.ssr).toBe(false);
    expect(stepperSpec.model).toBe("value");
    expect(stepperSpec.styles).toEqual(["stepper"]);
    expect(hasStyles("stepper")).toBe(true);
    // Every declared attribute is observed, so a change reaches the element
    const observed = (stepperElement.element as unknown as { observedAttributes: string[] }).observedAttributes;
    expect([...observed].sort()).toEqual(Object.keys(stepperSpec.attributes).sort());
    // The value property is the live one; the attribute is only its default
    expect(stepperSpec.properties.value.config).toBe("value");
    // The events re-dispatched from the host
    expect(Object.keys(stepperSpec.events).sort()).toEqual(["change", "complete", "error", "orientationchange", "reset"]);
    // Registration is a no-op the second time
    expect(defineStepper()).toBe("m-stepper");
    expect(customElements.get("m-stepper")).toBe(stepperElement.element);
  });

  test("<m-step> declares its attributes as properties", () => {
    const host = mount();
    const step = steps(host)[1] as HTMLElement & { optional: boolean; supportingText: string | null };
    expect(step.optional).toBe(true);
    step.supportingText = "Where to send it";
    expect(step.getAttribute("supporting-text")).toBe("Where to send it");
    step.optional = false;
    expect(step.hasAttribute("optional")).toBe(false);
    const declaration = customElements.get("m-step") as CustomElementConstructor;
    expect(typeof declaration).toBe("function");
    expect(Object.keys(stepDeclaration.attributes)).toContain("no-edit");
  });

  test("renders one panel per step and takes each step's content through its slot", () => {
    const host = mount();
    const root = shadow(host);
    const items = root.querySelectorAll(".mtrl-stepper__item");
    expect(items).toHaveLength(3);
    const slots = root.querySelectorAll<HTMLSlotElement>("slot[name^='step-']");
    expect(Array.from(slots).map((slot) => slot.name)).toEqual(["step-0", "step-1", "step-2"]);
    // The consumer's elements keep their content and gained only a slot name
    const [first, second] = steps(host);
    expect(first!.getAttribute("slot")).toBe("step-0");
    expect(second!.getAttribute("slot")).toBe("step-1");
    expect(first!.querySelector("#first")).not.toBeNull();
    // The first panel is shown, the others are hidden
    const panels = root.querySelectorAll<HTMLElement>(".mtrl-stepper__panel");
    expect(Array.from(panels).map((panel) => panel.hidden)).toEqual([false, true, true]);
  });

  test("attributes feed the component and the live property follows it", async () => {
    const host = mount('orientation="vertical" value="address"');
    expect(host.value).toBe("address");
    expect(host.getResolvedOrientation()).toBe("vertical");
    expect(shadow(host).querySelector(".mtrl-stepper")!.classList.contains("mtrl-stepper--vertical")).toBe(true);
    host.value = "review";
    await flush();
    expect(host.value).toBe("review");
    // Moving backwards is allowed when the step is editable, the default
    expect(await host.goTo("account")).toBe(true);
    expect(host.value).toBe("account");
  });

  test("a child attribute change updates the step in place", async () => {
    const host = mount();
    const step = steps(host)[1]!;
    step.setAttribute("label", "Delivery");
    step.setAttribute("supporting-text", "Pick a date");
    step.setAttribute("completed", "");
    step.setAttribute("error", "");
    await flush();
    const header = shadow(host).querySelectorAll(".mtrl-stepper__header")[1]!;
    expect(header.querySelector(".mtrl-stepper__label")!.textContent).toBe("Delivery");
    expect(header.querySelector(".mtrl-stepper__supporting-text")!.textContent).toBe("Pick a date");
    expect(header.getAttribute("aria-invalid")).toBe("true");
  });

  test("adding and removing <m-step> children updates the list", async () => {
    const host = mount();
    const extra = document.createElement("m-step");
    extra.setAttribute("value", "extra");
    extra.setAttribute("label", "Extra");
    host.append(extra);
    await flush();
    expect(shadow(host).querySelectorAll(".mtrl-stepper__item")).toHaveLength(4);
    extra.remove();
    await flush();
    expect(shadow(host).querySelectorAll(".mtrl-stepper__item")).toHaveLength(3);
  });

  test("no inline style.order is ever written on the consumer's steps", () => {
    const host = mount();
    const before = steps(host).map((step) => step.getAttribute("style"));
    host.orientation = "vertical";
    const after = steps(host).map((step) => step.getAttribute("style"));
    expect(before.every((value) => value === null)).toBe(true);
    expect(after).toEqual(before);
  });

  test("beforechange is a cancelable DOM event on the host", async () => {
    const host = mount();
    const seen: Array<{ previousValue: string; value: string; direction: string }> = [];
    host.addEventListener("beforechange", (event) => {
      const { previousValue, value, direction } = (event as CustomEvent).detail;
      seen.push({ previousValue, value, direction });
      event.preventDefault();
    });
    expect(await host.next()).toBe(false);
    expect(seen).toEqual([{ previousValue: "account", value: "address", direction: "forward" }]);
    expect(host.value).toBe("account");
    expect(host.getSteps()[0]!.completed).toBe(false);
  });
});
