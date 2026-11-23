import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { defineBreadcrumb } from "../../src/elements/breadcrumb";

// The element's class is built once against one realm
let dom: JSDOM;
const originalGlobals = new Map<string, PropertyDescriptor | undefined>();

beforeAll(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    MouseEvent: dom.window.MouseEvent,
    MutationObserver: dom.window.MutationObserver,
    customElements: dom.window.customElements,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  };
  for (const [name, value] of Object.entries(globals)) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  }
  defineBreadcrumb();
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

interface CrumbHost extends HTMLElement {
  component: import("../../src/components/breadcrumb").BreadcrumbComponent | null;
  getValue: () => string | null;
  goTo: (value: string) => boolean;
  getItems: () => Array<{ value: string }>;
}

const mount = (markup = ""): CrumbHost => {
  document.body.innerHTML = `<m-breadcrumb>${markup}</m-breadcrumb>`;
  return document.querySelector("m-breadcrumb") as CrumbHost;
};

describe("<m-breadcrumb>", () => {
  test("children become the trail, the last is current, and href is ignored there", () => {
    const host = mount(`
      <m-breadcrumb-item value="home" href="/">Home</m-breadcrumb-item>
      <m-breadcrumb-item value="rooms" href="/rooms">Rooms</m-breadcrumb-item>
      <m-breadcrumb-item value="chair" href="/chair">Chair</m-breadcrumb-item>`);
    const root = host.shadowRoot!;
    // Three trail items and the overflow item the collapse keeps in the list
    expect(root.querySelectorAll("li:not(.mtrl-breadcrumb__item--overflow)")).toHaveLength(3);
    const items = root.querySelectorAll("li");
    expect(items[0]!.querySelector("a")?.getAttribute("href")).toBe("/");
    expect(items[2]!.querySelector('[aria-current="page"]')?.textContent).toBe("Chair");
    expect(items[2]!.querySelector("a")).toBeNull();
    expect(host.getValue()).toBe("chair");
    expect(host.hasAttribute("value")).toBe(true);
  });

  test("beforechange is cancelable and change follows the commit", () => {
    const host = mount(`
      <m-breadcrumb-item value="home" href="/">Home</m-breadcrumb-item>
      <m-breadcrumb-item value="rooms">Rooms</m-breadcrumb-item>
      <m-breadcrumb-item value="chair">Chair</m-breadcrumb-item>`);
    const seen: unknown[] = [];
    let cancel = false;
    host.addEventListener("beforechange", (event) => {
      seen.push((event as CustomEvent).detail);
      if (cancel) event.preventDefault();
    });
    host.addEventListener("change", (event) => seen.push((event as CustomEvent).detail));
    const button = host.shadowRoot!.querySelectorAll("li button")[0] as HTMLButtonElement;
    button.click();
    expect(seen[0]).toEqual({ previousValue: "chair", value: "rooms" });
    expect(seen[1]).toEqual({ value: "rooms", previousValue: "chair" });
    cancel = true;
    button.click();
    expect(seen.at(-1)).toEqual({ previousValue: "chair", value: "rooms" });
    expect(host.getValue()).toBe("chair");
  });

  test("a child label change rebuilds the trail without writing style", () => {
    const host = mount(`
      <m-breadcrumb-item value="home">Home</m-breadcrumb-item>
      <m-breadcrumb-item value="chair">Chair</m-breadcrumb-item>`);
    const child = host.querySelector('m-breadcrumb-item[value="home"]')!;
    child.setAttribute("label", "Start");
    // The observer runs on the child's attribute change
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(host.shadowRoot!.querySelector("li")!.textContent).toContain("Start");
        expect(child.hasAttribute("style")).toBe(false);
        resolve();
      }, 10);
    });
  });

  test("a disabled breadcrumb disables the controls", () => {
    const host = mount(`
      <m-breadcrumb-item value="home">Home</m-breadcrumb-item>
      <m-breadcrumb-item value="chair">Chair</m-breadcrumb-item>`);
    host.setAttribute("disabled", "");
    const controls = host.shadowRoot!.querySelectorAll("li button");
    expect([...controls].every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  test("goTo and the item surface forward to the factory", () => {
    const host = mount(`
      <m-breadcrumb-item value="home">Home</m-breadcrumb-item>
      <m-breadcrumb-item value="chair">Chair</m-breadcrumb-item>`);
    expect(host.goTo("home")).toBe(true);
    expect(host.getItems()).toHaveLength(2);
    expect(host.getItems()[1]!.value).toBe("chair");
  });
});
