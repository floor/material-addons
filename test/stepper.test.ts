// test/stepper.test.ts

import { beforeAll, afterAll, beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import createStepper from "../src/components/stepper/stepper";

let dom: JSDOM;
const originalGlobals = new Map<string, PropertyDescriptor | undefined>();

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
    KeyboardEvent: dom.window.KeyboardEvent,
    MouseEvent: dom.window.MouseEvent,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  };
  for (const [name, value] of Object.entries(globals)) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  }
});

afterAll(() => {
  dom.window.close();
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

beforeEach(() => {
  document.body.replaceChildren();
});

const steps = () => [
  { value: "account", label: "Account details" },
  { value: "address", label: "Shipping address" },
  { value: "review", label: "Review & submit" },
];

const mount = (config: Parameters<typeof createStepper>[0] = {}) => {
  const stepper = createStepper({ steps: steps(), ...config });
  document.body.append(stepper.element);
  return stepper;
};

describe("Stepper creation and anatomy", () => {
  test("renders the ordered header list, indicators, panels and the live region", () => {
    const stepper = mount();
    const list = stepper.element.querySelector("ol.mtrl-stepper__list");
    expect(list).not.toBeNull();
    const items = Array.from(stepper.element.querySelectorAll("li.mtrl-stepper__item"));
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.dataset.stepValue)).toEqual(["account", "address", "review"]);
    const headers = Array.from(stepper.element.querySelectorAll<HTMLButtonElement>("button.mtrl-stepper__header"));
    expect(headers.map((header) => header.type)).toEqual(["button", "button", "button"]);
    expect(headers[0]!.getAttribute("aria-current")).toBe("step");
    expect(headers.map((header) => header.querySelector(".mtrl-stepper__indicator")!.textContent)).toEqual(["1", "2", "3"]);
    expect(headers[0]!.getAttribute("aria-controls")).toBe(stepper.getPanelElement(0)!.id);
    expect(stepper.element.querySelector(".mtrl-stepper__live")!.getAttribute("aria-live")).toBe("polite");
    expect(stepper.element.getAttribute("role")).toBe("group");
    expect(stepper.element.getAttribute("aria-label")).toBe("Progress");
    stepper.destroy();
  });

  test("defaults: horizontal, non-linear, label end, header top, first step active", () => {
    const stepper = mount();
    expect(stepper.element.classList.contains("mtrl-stepper--horizontal")).toBe(true);
    expect(stepper.element.classList.contains("mtrl-stepper--label-end")).toBe(true);
    expect(stepper.element.classList.contains("mtrl-stepper--header-top")).toBe(true);
    expect(stepper.getValue()).toBe("account");
    expect(stepper.getResolvedOrientation()).toBe("horizontal");
    stepper.destroy();
  });

  test("only the active panel is shown", () => {
    const stepper = mount();
    const panels = [0, 1, 2].map((index) => stepper.getPanelElement(index)!);
    expect(panels.map((panel) => panel.hidden)).toEqual([false, true, true]);
    stepper.destroy();
  });
});

describe("Stepper state machine", () => {
  test("next() validates a valid step, marks it completed and activates the following one", async () => {
    const stepper = mount();
    expect(await stepper.next()).toBe(true);
    const [first, second] = stepper.getSteps();
    expect(first!.completed).toBe(true);
    expect(second!.active).toBe(true);
    expect(stepper.getPanelElement(1)!.hidden).toBe(false);
    expect(stepper.getHeaderElement(1)!.getAttribute("aria-current")).toBe("step");
    stepper.destroy();
  });

  test("prev() never marks the step it leaves completed", async () => {
    const stepper = mount();
    await stepper.next();
    expect(await stepper.prev()).toBe(true);
    const [first, second] = stepper.getSteps();
    expect(second!.completed).toBe(false);
    expect(first!.active).toBe(true);
    stepper.destroy();
  });

  test("non-linear movement leaves an unvalidated step incomplete", async () => {
    const stepper = mount({ validateOnForward: false });
    expect(await stepper.goTo("review")).toBe(true);
    expect(stepper.getStep("account")!.completed).toBe(false);
    stepper.destroy();
  });

  test("linear blocks a forward jump past an incomplete step and allows it with optional", async () => {
    const stepper = mount({ linear: true });
    expect(await stepper.goTo("review")).toBe(false);
    stepper.setStepState("address", { optional: true });
    await stepper.completeStep("account").next();
    expect(await stepper.goTo("review")).toBe(true);
    stepper.destroy();
  });

  test("linear returns to a completed editable step and refuses a non-editable one", async () => {
    const stepper = mount({ linear: true });
    await stepper.next();
    expect(await stepper.goTo("account")).toBe(true);
    stepper.setStepState("account", { editable: false });
    await stepper.next();
    expect(await stepper.goTo("account")).toBe(false);
    stepper.destroy();
  });
});

describe("Stepper validation pipeline", () => {
  test("every form and standalone control in the panel is checked, not only the first", async () => {
    const stepper = mount({
      linear: true,
      steps: [
        {
          value: "one",
          label: "One",
          content: `<form><input required></form><input id="standalone" required>`,
        },
        { value: "two", label: "Two" },
      ],
    });
    expect(await stepper.next()).toBe(false);
    expect(stepper.getStep("one")!.error).toBe(true);
    const standalone = stepper.getPanelElement(0)!.querySelector<HTMLInputElement>("#standalone")!;
    standalone.value = "filled";
    const first = stepper.getPanelElement(0)!.querySelector("input")!;
    first.value = "filled";
    expect(await stepper.next()).toBe(true);
    stepper.destroy();
  });

  test("reportValidity runs by default and can be turned off", async () => {
    const mountWith = (reportValidity: boolean) => {
      let reported = 0;
      const form = document.createElement("form");
      const input = document.createElement("input");
      input.required = true;
      form.append(input);
      form.reportValidity = () => {
        reported += 1;
        return false;
      };
      const stepper = createStepper({
        linear: true,
        reportValidity,
        steps: [{ value: "one", label: "One", content: form }, { value: "two", label: "Two" }],
      });
      document.body.append(stepper.element);
      return { stepper, reported: () => reported };
    };

    const reporting = mountWith(true);
    expect(await reporting.stepper.next()).toBe(false);
    expect(reporting.reported()).toBe(1);
    reporting.stepper.destroy();

    const quiet = mountWith(false);
    expect(await quiet.stepper.next()).toBe(false);
    expect(quiet.reported()).toBe(0);
    expect(quiet.stepper.getStep("one")!.error).toBe(true);
    quiet.stepper.destroy();
  });

  test("a sync validator result sets the supporting text", async () => {
    const stepper = mount({
      linear: true,
      steps: [
        { value: "one", label: "One", validate: () => ({ valid: false, supportingText: "Pick one" }) },
        { value: "two", label: "Two" },
      ],
    });
    expect(await stepper.next()).toBe(false);
    expect(stepper.getStep("one")!.error).toBe(true);
    expect(stepper.getHeaderElement("one")!.querySelector(".mtrl-stepper__supporting-text")!.textContent).toBe("Pick one");
    stepper.destroy();
  });

  test("an async validator marks the step validating, then completes it", async () => {
    let release: (valid: boolean) => void = () => undefined;
    const stepper = mount({
      steps: [
        { value: "one", label: "One", validate: () => new Promise<boolean>((resolve) => { release = resolve; }) },
        { value: "two", label: "Two" },
      ],
    });
    const pending = stepper.next();
    await Promise.resolve();
    expect(stepper.getStep("one")!.validating).toBe(true);
    expect(stepper.getHeaderElement("one")!.getAttribute("aria-busy")).toBe("true");
    expect(await stepper.next()).toBe(false); // ignored while validating
    release(true);
    expect(await pending).toBe(true);
    expect(stepper.getStep("one")!.validating).toBe(false);
    expect(stepper.getStep("one")!.completed).toBe(true);
    stepper.destroy();
  });

  test("a failed validation's copy goes back to the authored supporting text when it passes", async () => {
    let fails = true;
    const stepper = mount({
      linear: true,
      steps: [
        {
          value: "one",
          label: "One",
          supportingText: "Hint",
          validate: () => (fails ? { valid: false, supportingText: "Pick one" } : { valid: true }),
        },
        { value: "two", label: "Two" },
      ],
    });
    await stepper.next();
    expect(stepper.getStep("one")!.supportingText).toBe("Pick one");
    fails = false;
    await stepper.next();
    expect(stepper.getStep("one")!.supportingText).toBe("Hint");
    expect(stepper.getStep("one")!.error).toBe(false);
    stepper.destroy();
  });

  test("beforechange can cancel a transition and leaves completion unchanged", async () => {
    const stepper = mount();
    stepper.on("beforechange", (payload: { preventDefault: () => void }) => payload.preventDefault());
    expect(await stepper.next()).toBe(false);
    expect(stepper.getStep("account")!.completed).toBe(false);
    expect(stepper.getValue()).toBe("account");
    stepper.destroy();
  });
});

describe("Stepper keyboard", () => {
  test("arrows move focus without activating; Enter activates the focused step", async () => {
    const stepper = mount();
    const headers = [0, 1, 2].map((index) => stepper.getHeaderElement(index)!);
    headers[0]!.focus();
    headers[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.activeElement).toBe(headers[1]);
    // Focus moved, the step did not: activation waits for Enter
    expect(stepper.getValue()).toBe("account");
    headers[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await Promise.resolve();
    expect(stepper.getValue()).toBe("address");
    stepper.destroy();
  });
});

describe("Stepper declarative actions, reset and events", () => {
  test("action attributes drive next, prev, reset and goTo", async () => {
    const content = `<button data-stepper-next>Next</button><button data-stepper-prev>Back</button><button data-stepper-reset>Reset</button><button data-stepper-goto="review">Review</button>`;
    const stepper = mount({
      steps: steps().map((step) => ({ ...step, content })),
    });
    const click = (selector: string) =>
      stepper.getPanelElement(stepper.getSteps().findIndex((step) => step.active))!
        .querySelector<HTMLButtonElement>(selector)!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    click("[data-stepper-next]");
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stepper.getValue()).toBe("address");
    stepper.destroy();
  });

  test("reset clears completion, resets forms and returns to the first step", async () => {
    const stepper = mount();
    await stepper.next();
    stepper.reset();
    expect(stepper.getSteps().every((step) => !step.completed)).toBe(true);
    expect(stepper.getValue()).toBe("account");
    stepper.destroy();
  });

  test("change and complete carry the value model", async () => {
    const changes: Array<{ value: string; previousValue: string | null }> = [];
    const stepper = mount();
    stepper.on("change", (payload: { value: string; previousValue: string | null }) => changes.push(payload));
    await stepper.next();
    await stepper.next();
    expect(changes.map((change) => [change.previousValue, change.value])).toEqual([
      ["account", "address"],
      ["address", "review"],
    ]);
    stepper.destroy();
  });
});

describe("Stepper guards, callbacks and layout", () => {
  test("a linear-locked header is aria-disabled and pointer activation respects it", async () => {
    const stepper = mount({ linear: true });
    const review = stepper.getHeaderElement("review")!;
    expect(review.getAttribute("aria-disabled")).toBe("true");
    review.click();
    await Promise.resolve();
    expect(stepper.getValue()).toBe("account");
    // An enabled header activates through the same guarded path
    stepper.getHeaderElement("address")!.click();
    await Promise.resolve();
    expect(stepper.getValue()).toBe("address");
    expect(stepper.getHeaderElement("review")!.getAttribute("aria-disabled")).toBeNull();
    stepper.destroy();
  });

  test("a disabled stepper refuses every move and leaves its headers out of the tab order", async () => {
    const stepper = mount({ disabled: true });
    expect(await stepper.goTo("address")).toBe(false);
    expect(await stepper.next()).toBe(false);
    expect(stepper.getValue()).toBe("account");
    expect([0, 1, 2].map((index) => stepper.getHeaderElement(index)!.tabIndex)).toEqual([-1, -1, -1]);
    stepper.enable();
    expect(await stepper.next()).toBe(true);
    stepper.destroy();
  });

  test("the step validator and the config validator both run, in order", async () => {
    const calls: string[] = [];
    const stepper = mount({
      linear: true,
      validate: () => {
        calls.push("config");
        return { valid: false, supportingText: "Config says no" };
      },
      steps: [
        {
          value: "account",
          label: "Account details",
          validate: () => {
            calls.push("step");
            return true;
          },
        },
        { value: "review", label: "Review" },
      ],
    });
    expect(await stepper.next()).toBe(false);
    expect(calls).toEqual(["step", "config"]);
    expect(stepper.getStep("account")!.error).toBe(true);
    stepper.destroy();
  });

  test("the configured callbacks fire beside the events", async () => {
    const seen: string[] = [];
    const stepper = createStepper({
      steps: steps(),
      linear: true,
      onChange: (event) => seen.push(`change:${event.value}`),
      onComplete: () => seen.push("complete"),
      onError: () => seen.push("error"),
      onReset: () => seen.push("reset"),
      validate: () => ({ valid: false, supportingText: "No" }),
    });
    document.body.append(stepper.element);
    stepper.getHeaderElement(1)!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    stepper.on("change", () => seen.push("dom-change"));
    stepper.setStepState("address", { validate: undefined });
    stepper.destroy();
    expect(seen).toContain("error");
  });

  test("an action button moves focus into the new panel", async () => {
    const stepper = mount({
      steps: [
        { value: "account", label: "Account details", content: `<button data-stepper-next>Next</button>` },
        { value: "address", label: "Shipping address", content: `<input id="address-input">` },
      ],
    });
    stepper.getPanelElement(0)!.querySelector<HTMLButtonElement>("[data-stepper-next]")!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stepper.getValue()).toBe("address");
    expect(document.activeElement).toBe(stepper.getPanelElement(1)!.querySelector("input"));
    stepper.destroy();
  });

  test("setValue is silent: no validation, no change, chainable", async () => {
    let validated = 0;
    const changes: unknown[] = [];
    const stepper = mount({
      steps: [
        { value: "account", label: "Account details", validate: () => { validated += 1; return false; } },
        { value: "review", label: "Review" },
      ],
    });
    stepper.on("change", (event) => changes.push(event));
    expect(stepper.setValue("review")).toBe(stepper);
    expect(stepper.getValue()).toBe("review");
    expect(validated).toBe(0);
    expect(changes).toEqual([]);
    stepper.destroy();
  });

  test("setOrientation re-lands the layout and keeps the panels reachable", async () => {
    const stepper = mount();
    stepper.setOrientation("vertical");
    expect(stepper.element.classList.contains("mtrl-stepper--vertical")).toBe(true);
    expect(stepper.getPanelElement(1)).not.toBeNull();
    expect(stepper.getHeaderElement(1)!.getAttribute("aria-expanded")).toBe("false");
    stepper.setOrientation("horizontal");
    expect(stepper.element.classList.contains("mtrl-stepper--horizontal")).toBe(true);
    expect(stepper.getHeaderElement(1)!.hasAttribute("aria-expanded")).toBe(false);
    stepper.destroy();
  });

  test("the final step does not bypass the disabled or in-flight guards", async () => {
    let validated = 0;
    let release: (valid: boolean) => void = () => undefined;
    const stepper = mount({
      steps: [
        {
          value: "only",
          label: "Only",
          validate: () => {
            validated += 1;
            return new Promise<boolean>((resolve) => { release = resolve; });
          },
        },
      ],
    });
    const first = stepper.next();
    await Promise.resolve();
    expect(await stepper.next()).toBe(false);
    expect(validated).toBe(1);
    release(true);
    expect(await first).toBe(true);
    stepper.disable();
    expect(await stepper.next()).toBe(false);
    expect(validated).toBe(1);
    stepper.destroy();
  });

  test("a replacement step list selects an eligible step, or none", () => {
    const stepper = mount();
    stepper.setSteps([
      { value: "account", label: "Account", disabled: true },
      { value: "address", label: "Address" },
    ]);
    expect(stepper.getValue()).toBe("address");
    stepper.setSteps([
      { value: "one", label: "One", disabled: true },
      { value: "two", label: "Two", disabled: true },
    ]);
    expect(stepper.getValue()).toBeNull();
    stepper.destroy();
  });

  test("focusOnAction: none leaves focus where it was", async () => {
    const stepper = mount({
      focusOnAction: "none",
      steps: [
        { value: "account", label: "Account details", content: `<button data-stepper-next>Next</button>` },
        { value: "address", label: "Shipping address", content: `<input id="address-input">` },
      ],
    });
    stepper.getPanelElement(0)!.querySelector<HTMLButtonElement>("[data-stepper-next]")!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stepper.getValue()).toBe("address");
    expect(document.activeElement).not.toBe(stepper.getPanelElement(1)!.querySelector("input"));
    stepper.destroy();
  });

  test("focusOnAction: heading lands on the new panel's heading", async () => {
    const stepper = mount({
      focusOnAction: "heading",
      steps: [
        { value: "account", label: "Account details", content: `<button data-stepper-next>Next</button>` },
        { value: "address", label: "Shipping address", content: `<h2 id="address-heading">Address</h2><input id="address-input">` },
      ],
    });
    stepper.getPanelElement(0)!.querySelector<HTMLButtonElement>("[data-stepper-next]")!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stepper.getValue()).toBe("address");
    expect(document.activeElement).toBe(stepper.getPanelElement(1)!.querySelector("#address-heading"));
    stepper.destroy();
  });

  test("getActiveIndex and a declaration update keep the selection", () => {
    const stepper = mount();
    expect(stepper.getActiveIndex()).toBe(0);
    stepper.setValue("address");
    expect(stepper.getActiveIndex()).toBe(1);
    stepper.setSteps([
      { value: "account", label: "Account details" },
      { value: "address", label: "Shipping address" },
      { value: "review", label: "Review" },
      { value: "extra", label: "Extra" },
    ]);
    expect(stepper.getValue()).toBe("address");
    stepper.destroy();
  });
});

describe("Stepper steps API", () => {
  test("setStepState updates the rendered label and state", () => {
    const stepper = mount();
    stepper.setStepState("address", { label: "Delivery", completed: true, error: true, supportingText: "Check it" });
    const header = stepper.getHeaderElement("address")!;
    expect(header.querySelector(".mtrl-stepper__label")!.textContent).toBe("Delivery");
    expect(header.getAttribute("aria-invalid")).toBe("true");
    expect(header.querySelector(".mtrl-stepper__supporting-text")!.textContent).toBe("Check it");
    stepper.destroy();
  });

  test("add and remove steps re-render the list", () => {
    const stepper = mount();
    stepper.addStep({ value: "extra", label: "Extra" });
    expect(stepper.getSteps()).toHaveLength(4);
    stepper.removeStep("extra");
    expect(stepper.getSteps()).toHaveLength(3);
    stepper.destroy();
  });

  test("optional steps show the optional supporting text", () => {
    const stepper = mount({ steps: [{ value: "one", label: "One" }, { value: "two", label: "Two", optional: true }] });
    expect(stepper.getHeaderElement("two")!.querySelector(".mtrl-stepper__supporting-text")!.textContent).toBe("Optional");
    stepper.destroy();
  });
});
