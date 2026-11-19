// test/elements/expansion-panel.test.ts

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { defineExpansionPanel } from "../../src/elements/expansion-panel";
import { registerStyles } from "material/elements";

let dom: JSDOM;
const originalGlobals = new Map<string, PropertyDescriptor | undefined>();

beforeAll(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
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
  registerStyles({ ripple: "", "expansion-panel": "" });
  defineExpansionPanel();
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 320));

type PanelHost = HTMLElement & {
  open: boolean;
  label: string;
  variant: string | null;
  isOpen: () => boolean;
  component: unknown;
};

const mountPanel = (attributes = "", children = "") => {
  document.body.innerHTML = `<m-expansion-panel ${attributes}>${children}</m-expansion-panel>`;
  return document.querySelector("m-expansion-panel") as unknown as PanelHost;
};

describe("<m-expansion-panel> and <m-accordion>", () => {
  test("registers both tags and reflects attributes", async () => {
    expect(customElements.get("m-expansion-panel")).toBeDefined();
    expect(customElements.get("m-accordion")).toBeDefined();
    const host = mountPanel('label="Trip details" supporting-text="Start and end dates" value="trip"');
    expect(host.shadowRoot!.querySelector(".mtrl-expansion-panel__label")!.textContent).toBe("Trip details");
    expect(host.getAttribute("value")).toBe("trip");
    host.setAttribute("variant", "elevated");
    await Promise.resolve();
    expect(host.shadowRoot!.querySelector(".mtrl-expansion-panel")!.classList.contains("mtrl-expansion-panel--elevated")).toBe(true);
    expect(host.variant).toBe("elevated");
  });

  test("open attribute and state follow each other, and the event reaches the host", async () => {
    const host = mountPanel('label="One"');
    let opened = 0;
    host.addEventListener("open", () => (opened += 1));
    // An attribute change is a programmatic state update: quiet, as defineElement
    // has every update. The event comes with the component's own open().
    host.setAttribute("open", "");
    await settle();
    expect(host.hasAttribute("open")).toBe(true);
    expect((host as unknown as { component: { isOpen: () => boolean } }).component.isOpen()).toBe(true);
    expect(opened).toBe(0);
    (host as unknown as { component: { close: () => void } }).component.close();
    await settle();
    expect(host.hasAttribute("open")).toBe(false);
    (host as unknown as { component: { open: () => void } }).component.open();
    await settle();
    expect(opened).toBe(1);
  });

  test("the default slot is the body, and a slotted action shows the actions bar", async () => {
    const host = mountPanel('label="One"', `<p id="body">Body text</p><button slot="actions" id="act">Save</button>`);
    host.setAttribute("open", "");
    await settle();
    const bar = host.shadowRoot!.querySelector(".mtrl-expansion-panel__actions") as HTMLElement;
    expect(bar.hidden).toBe(false);
    expect(host.querySelector("slot[name='actions']")).toBeNull();
    expect(host.querySelector("[slot='actions']")).not.toBeNull();
    expect(host.querySelector("#body")).not.toBeNull();
  });

  test("a cancelable beforeopen on the host vetoes the opening", async () => {
    const host = mountPanel('label="One"');
    host.addEventListener("beforeopen", (event) => event.preventDefault());
    (host as unknown as { component: { open: () => void } }).component.open();
    await settle();
    expect(host.hasAttribute("open")).toBe(false);
  });

  test("a host veto puts the open attribute back", async () => {
    const host = mountPanel('label="One"');
    host.addEventListener("beforeopen", (event) => event.preventDefault());
    host.setAttribute("open", "");
    await settle();
    expect(host.hasAttribute("open")).toBe(false);
  });

  test("a vetoed close keeps the open attribute", async () => {
    const host = mountPanel('label="One" open');
    await settle();
    host.addEventListener("beforeclose", (event) => event.preventDefault());
    host.removeAttribute("open");
    await settle();
    expect(host.hasAttribute("open")).toBe(true);
    expect((host as unknown as { component: { isOpen: () => boolean } }).component.isOpen()).toBe(true);
  });

  test("openPanel opens a closed panel", async () => {
    const host = mountPanel('label="One"');
    (host as unknown as { openPanel: () => void }).openPanel();
    await settle();
    expect(host.hasAttribute("open")).toBe(true);
    expect((host as unknown as { component: { isOpen: () => boolean } }).component.isOpen()).toBe(true);
  });

  test("the authored value opens its panel once the children are claimed", async () => {
    document.body.innerHTML = `
      <m-accordion value="b">
        <m-expansion-panel value="a" label="A"></m-expansion-panel>
        <m-expansion-panel value="b" label="B"></m-expansion-panel>
      </m-accordion>`;
    await new Promise((resolve) => setTimeout(resolve, 60));
    const accordion = document.querySelector("m-accordion") as unknown as {
      getValue: () => string | null;
      getPanels: () => Array<{ isOpen: () => boolean }>;
    };
    expect(accordion.getValue()).toBe("b");
    expect(accordion.getPanels().map((panel) => panel.isOpen())).toEqual([false, true]);
  });

  test("a panel child added later is claimed", async () => {
    document.body.innerHTML = `<m-accordion><m-expansion-panel value="a" label="A"></m-expansion-panel></m-accordion>`;
    await new Promise((resolve) => setTimeout(resolve, 60));
    const accordion = document.querySelector("m-accordion") as unknown as {
      getPanels: () => unknown[];
      getValue: () => string | null;
    };
    const extra = document.createElement("m-expansion-panel");
    extra.setAttribute("value", "b");
    extra.setAttribute("label", "B");
    document.querySelector("m-accordion")!.append(extra);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(accordion.getPanels()).toHaveLength(2);
    (extra as unknown as { component: { open: () => void } }).component.open();
    expect(accordion.getValue()).toBe("b");
  });

  test("an accordion claims its panel children and coordinates them", async () => {
    document.body.innerHTML = `
      <m-accordion>
        <m-expansion-panel value="a" label="A"></m-expansion-panel>
        <m-expansion-panel value="b" label="B"></m-expansion-panel>
      </m-accordion>`;
    const accordion = document.querySelector("m-accordion") as unknown as HTMLElement & {
      getPanels: () => unknown[];
      getValue: () => string | null;
      setValue: (value: string | null) => unknown;
    };
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(accordion.getPanels()).toHaveLength(2);
    accordion.setValue("a");
    expect(accordion.getValue()).toBe("a");
    accordion.setValue("b");
    expect(accordion.getValue()).toBe("b");
    const first = document.querySelector("m-expansion-panel[value='a']") as unknown as PanelHost;
    expect(first.hasAttribute("open")).toBe(false);
  });

  test("a silent change still reflects on the host", async () => {
    document.body.innerHTML = `
      <m-accordion value="b">
        <m-expansion-panel value="a" label="A" open></m-expansion-panel>
        <m-expansion-panel value="b" label="B"></m-expansion-panel>
      </m-accordion>`;
    await new Promise((resolve) => setTimeout(resolve, 30));
    const accordion = document.querySelector("m-accordion") as unknown as HTMLElement & {
      closeAll: () => unknown;
    };
    const a = document.querySelector("m-expansion-panel[value='a']") as unknown as PanelHost;
    const b = document.querySelector("m-expansion-panel[value='b']") as unknown as PanelHost;
    // The authored value wins silently: the attribute follows, without events
    expect(a.open).toBe(false);
    expect(a.hasAttribute("open")).toBe(false);
    expect(b.open).toBe(true);
    expect(b.hasAttribute("open")).toBe(true);
    // A direct silent setter reflects too
    a.component!.setOpen(true);
    expect(a.open).toBe(true);
    expect(a.hasAttribute("open")).toBe(true);
    // And so does the group's silent close
    accordion.closeAll();
    expect(a.open).toBe(false);
    expect(a.hasAttribute("open")).toBe(false);
    expect(b.hasAttribute("open")).toBe(false);
  });

  test("a removed panel child leaves the group", async () => {
    document.body.innerHTML = `
      <m-accordion>
        <m-expansion-panel value="a" label="A"></m-expansion-panel>
        <m-expansion-panel value="b" label="B"></m-expansion-panel>
      </m-accordion>`;
    const accordion = document.querySelector("m-accordion") as unknown as HTMLElement & {
      getPanels: () => unknown[];
      getValues: () => string[];
    };
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(accordion.getPanels()).toHaveLength(2);
    const removed = document.querySelector("m-expansion-panel[value='b']") as unknown as PanelHost;
    removed.remove();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(accordion.getPanels()).toHaveLength(1);
    // The removed child's component is disposed with it, so it cannot
    // coordinate, and the group's own panel still opens alone
    expect(removed.component).toBeNull();
    (document.querySelector("m-expansion-panel[value='a']") as unknown as PanelHost).component!.open();
    expect(accordion.getValues()).toEqual(["a"]);
  });
});
