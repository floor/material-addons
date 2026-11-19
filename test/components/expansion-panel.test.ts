// test/components/expansion-panel.test.ts

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import createExpansionPanel from "../../src/components/expansion-panel/expansion-panel";
import createAccordion from "../../src/components/expansion-panel/accordion";

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
    Node: dom.window.Node,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    KeyboardEvent: dom.window.KeyboardEvent,
    MouseEvent: dom.window.MouseEvent,
    TransitionEvent: dom.window.Event,
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

/** The collapse settles on transitionend or its duration timer */
const settle = () => new Promise((resolve) => setTimeout(resolve, 320));

describe("Expansion panel anatomy and state", () => {
  test("builds the heading, trigger, toggle and hidden region", () => {
    const panel = createExpansionPanel({ label: "Trip details", supportingText: "Start and end dates" });
    document.body.append(panel.element);
    const heading = panel.element.querySelector("h3");
    expect(heading).not.toBeNull();
    expect(heading!.className).toContain("mtrl-expansion-panel__heading");
    const header = panel.header;
    expect(header.tagName).toBe("BUTTON");
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(header.getAttribute("aria-controls")).toBe(panel.region.id);
    expect(panel.region.getAttribute("role")).toBe("region");
    expect(panel.region.getAttribute("aria-labelledby")).toBe(header.id);
    expect(panel.region.hidden).toBe(true);
    expect(panel.element.querySelector(".mtrl-expansion-panel__label")!.textContent).toBe("Trip details");
    expect(panel.element.querySelector(".mtrl-expansion-panel__supporting-text")!.textContent).toBe("Start and end dates");
    expect(panel.element.querySelector(".mtrl-expansion-panel__toggle")).not.toBeNull();
    expect(panel.isOpen()).toBe(false);
    panel.destroy();
  });

  test("open and close move aria-expanded, the open class and the region", async () => {
    const panel = createExpansionPanel({ label: "One", content: "<p>Body</p>" });
    document.body.append(panel.element);
    panel.open();
    expect(panel.isOpen()).toBe(true);
    expect(panel.header.getAttribute("aria-expanded")).toBe("true");
    expect(panel.element.classList.contains("mtrl-expansion-panel--open")).toBe(true);
    expect(panel.region.hidden).toBe(false);
    expect(panel.body.querySelector("p")!.textContent).toBe("Body");
    panel.close();
    expect(panel.isOpen()).toBe(false);
    expect(panel.region.inert).toBe(true);
    await settle();
    expect(panel.region.hidden).toBe(true);
    panel.destroy();
  });

  test("beforeopen and beforeclose can cancel", async () => {
    const panel = createExpansionPanel({ label: "One" });
    document.body.append(panel.element);
    panel.on("beforeopen", (event) => event.preventDefault());
    panel.open();
    expect(panel.isOpen()).toBe(false);
    panel.off("beforeopen", () => undefined);
    panel.setOpen(true);
    await settle();
    let prevented = true;
    panel.on("beforeclose", (event) => {
      if (prevented) event.preventDefault();
    });
    panel.close();
    expect(panel.isOpen()).toBe(true);
    prevented = false;
    panel.close();
    expect(panel.isOpen()).toBe(false);
    panel.destroy();
  });

  test("setOpen is silent: no change event", async () => {
    const panel = createExpansionPanel({ label: "One" });
    document.body.append(panel.element);
    const changes: boolean[] = [];
    panel.on("change", (event) => changes.push(event.open));
    panel.setOpen(true);
    expect(panel.isOpen()).toBe(true);
    expect(changes).toEqual([]);
    await settle();
    panel.destroy();
  });

  test("lazy defers the content function until the first open", () => {
    let calls = 0;
    const panel = createExpansionPanel({
      label: "One",
      lazy: true,
      content: (body) => {
        calls += 1;
        body.textContent = "Rendered";
      },
    });
    document.body.append(panel.element);
    expect(calls).toBe(0);
    panel.open();
    expect(calls).toBe(1);
    panel.close();
    panel.open();
    expect(calls).toBe(1);
    expect(panel.body.textContent).toBe("Rendered");
    panel.destroy();
  });
});

describe("Expansion panel options and setters", () => {
  test("variant, density and placement reach the class list", () => {
    const panel = createExpansionPanel({ label: "One", variant: "elevated", density: "compact", placement: "start" });
    document.body.append(panel.element);
    expect(panel.element.classList.contains("mtrl-expansion-panel--elevated")).toBe(true);
    expect(panel.element.classList.contains("mtrl-expansion-panel--compact")).toBe(true);
    expect(panel.element.classList.contains("mtrl-expansion-panel--placement-start")).toBe(true);
    panel.setVariant("filled");
    expect(panel.getVariant()).toBe("filled");
    expect(panel.element.classList.contains("mtrl-expansion-panel--filled")).toBe(true);
    expect(panel.element.classList.contains("mtrl-expansion-panel--elevated")).toBe(false);
    panel.setDensity("default");
    expect(panel.getDensity()).toBe("default");
    expect(panel.element.classList.contains("mtrl-expansion-panel--compact")).toBe(false);
    panel.setPlacement("end");
    expect(panel.getPlacement()).toBe("end");
    panel.destroy();
  });

  test("labels and the error state", () => {
    const panel = createExpansionPanel({ label: "One", supportingText: "Hint" });
    document.body.append(panel.element);
    expect(panel.getLabel()).toBe("One");
    panel.setLabel("Two");
    expect(panel.getLabel()).toBe("Two");
    expect(panel.getSupportingText()).toBe("Hint");
    panel.setError(true, "Card expired");
    expect(panel.isError()).toBe(true);
    expect(panel.element.classList.contains("mtrl-expansion-panel--error")).toBe(true);
    expect(panel.getSupportingText()).toBe("Card expired");
    panel.setError(false);
    expect(panel.isError()).toBe(false);
    expect(panel.element.classList.contains("mtrl-expansion-panel--error")).toBe(false);
    panel.destroy();
  });

  test("a disabled panel does not open, and enable restores it", () => {
    const panel = createExpansionPanel({ label: "One", disabled: true });
    document.body.append(panel.element);
    expect(panel.header.disabled).toBe(true);
    panel.open();
    expect(panel.isOpen()).toBe(false);
    panel.enable();
    panel.open();
    expect(panel.isOpen()).toBe(true);
    panel.destroy();
  });
});

describe("Accordion coordination", () => {
  const panels = () => [
    { value: "a", label: "A" },
    { value: "b", label: "B" },
    { value: "c", label: "C" },
  ];

  test("single mode: opening a second panel closes the first", () => {
    const accordion = createAccordion({ panels: panels() });
    document.body.append(accordion.element);
    const changes: Array<{ value: string | null; values: string[]; open: boolean }> = [];
    accordion.on("change", (event) => changes.push({ value: event.value, values: event.values, open: event.open }));
    accordion.getPanel("a")!.open();
    expect(accordion.getValue()).toBe("a");
    expect(accordion.getValues()).toEqual(["a"]);
    accordion.getPanel("b")!.open();
    expect(accordion.getValue()).toBe("b");
    expect(accordion.getValues()).toEqual(["b"]);
    expect(accordion.getPanel("a")!.isOpen()).toBe(false);
    expect(changes.map((change) => [change.value, change.values])).toEqual([
      ["a", ["a"]],
      ["b", ["b"]],
    ]);
    accordion.destroy();
  });

  test("multi mode keeps both open, and openAll/closeAll work", () => {
    const accordion = createAccordion({ panels: panels(), multiSelect: true });
    document.body.append(accordion.element);
    accordion.getPanel("a")!.open();
    accordion.getPanel("b")!.open();
    expect(accordion.getValues()).toEqual(["a", "b"]);
    expect(accordion.getValue()).toBe("a");
    accordion.closeAll();
    expect(accordion.getValues()).toEqual([]);
    accordion.openAll();
    expect(accordion.getValues()).toEqual(["a", "b", "c"]);
    accordion.destroy();
  });

  test("arrow keys move focus between enabled headers with wrap", () => {
    const accordion = createAccordion({ panels: [...panels(), { value: "d", label: "D", disabled: true }] });
    document.body.append(accordion.element);
    const headers = accordion.getPanels().map((panel) => panel.header);
    headers[0]!.focus();
    headers[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement).toBe(headers[1]);
    headers[2]!.focus();
    headers[2]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    // d is disabled: wrap to the first enabled header
    expect(document.activeElement).toBe(headers[0]);
    headers[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(document.activeElement).toBe(headers[0]);
    headers[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(document.activeElement).toBe(headers[2]);
    accordion.destroy();
  });
});
