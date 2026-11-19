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

  test("the open event sees the region already shown", () => {
    const panel = createExpansionPanel({ label: "One" });
    document.body.append(panel.element);
    let seen: { hidden: boolean; inert: boolean } | null = null;
    panel.on("open", () => {
      seen = { hidden: panel.region.hidden, inert: panel.region.inert };
    });
    panel.open();
    expect(seen).toEqual({ hidden: false, inert: false });
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

describe("Expansion panel disclosure identity", () => {
  test("two panels never share a header or region id", () => {
    const first = createExpansionPanel({ label: "One" });
    const second = createExpansionPanel({ label: "Two" });
    document.body.append(first.element, second.element);
    expect(first.header.id).not.toBe(second.header.id);
    expect(first.region.id).not.toBe(second.region.id);
    expect(first.header.getAttribute("aria-controls")).toBe(first.region.id);
    expect(second.header.getAttribute("aria-controls")).toBe(second.region.id);
    first.destroy();
    second.destroy();
  });

  test("heading level is normalised: 4 is an h4, 7 falls back to h3", () => {
    const four = createExpansionPanel({ label: "Four", headingLevel: 4 });
    expect(four.element.querySelector("h4")).not.toBeNull();
    const seven = createExpansionPanel({ label: "Seven", headingLevel: 7 as never });
    expect(seven.element.querySelector("h3")).not.toBeNull();
    expect(seven.element.querySelector("h7")).toBeNull();
    four.destroy();
    seven.destroy();
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

describe("Accordion one-open invariant", () => {
  const setup = () =>
    createAccordion({
      panels: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
        { value: "c", label: "C" },
      ],
    });

  test("a vetoed close keeps the open panel and refuses the new one", () => {
    const accordion = setup();
    document.body.append(accordion.element);
    accordion.getPanel("a")!.open();
    accordion.getPanel("a")!.on("beforeclose", (event) => event.preventDefault());
    accordion.getPanel("b")!.open();
    expect(accordion.getPanel("a")!.isOpen()).toBe(true);
    expect(accordion.getPanel("b")!.isOpen()).toBe(false);
    expect(accordion.getValues()).toEqual(["a"]);
    accordion.destroy();
  });

  test("setValues and openAll open one panel in single-select mode", () => {
    const accordion = setup();
    document.body.append(accordion.element);
    accordion.setValues(["a", "b"]);
    expect(accordion.getValues()).toEqual(["a"]);
    accordion.closeAll();
    accordion.openAll();
    expect(accordion.getValues()).toEqual(["a"]);
    // A panel other than the first is already open: openAll still leaves one
    accordion.getPanel("c")!.open();
    expect(accordion.getValues()).toEqual(["c"]);
    accordion.openAll();
    expect(accordion.getValues()).toEqual(["a"]);
    expect(accordion.getPanel("c")!.isOpen()).toBe(false);
    accordion.destroy();
  });

  test("two panels that start open converge to the first", () => {
    const accordion = createAccordion({
      panels: [
        { value: "a", label: "A", open: true },
        { value: "b", label: "B", open: true },
      ],
    });
    document.body.append(accordion.element);
    expect(accordion.getValues()).toEqual(["a"]);
    expect(accordion.getPanel("b")!.isOpen()).toBe(false);
    accordion.destroy();
  });

  test("a vetoed switch opens nothing and emits no open event", () => {
    const accordion = setup();
    document.body.append(accordion.element);
    accordion.getPanel("a")!.open();
    accordion.getPanel("a")!.on("beforeclose", (event) => event.preventDefault());
    const opened: string[] = [];
    accordion.getPanel("b")!.on("open", (event) => opened.push(event.value));
    accordion.getPanel("b")!.open();
    expect(opened).toEqual([]);
    expect(accordion.getPanel("b")!.isOpen()).toBe(false);
    expect(accordion.getValues()).toEqual(["a"]);
    accordion.destroy();
  });

  test("addPanel registers the panel for coordination", () => {
    const accordion = setup();
    document.body.append(accordion.element);
    accordion.getPanel("a")!.open();
    const extra = createExpansionPanel({ value: "d", label: "D" });
    accordion.addPanel(extra);
    extra.open();
    expect(accordion.getPanel("a")!.isOpen()).toBe(false);
    expect(accordion.getValue()).toBe("d");
    accordion.destroy();
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
    // The closing panel's state change is a real one, then the opening's
    expect(changes.map((change) => [change.value, change.values])).toEqual([
      ["a", ["a"]],
      [null, []],
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
