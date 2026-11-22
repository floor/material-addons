import { afterEach, beforeEach } from "bun:test";
import { JSDOM } from "jsdom";

export function installAutocompleteDom() {
  let dom: JSDOM;
  const original = new Map<string, PropertyDescriptor | undefined>();
  beforeEach(() => {
    dom = new JSDOM("<!doctype html><body></body>", { pretendToBeVisual: true });
    const win = dom.window;
    const globals = {
      window: win, document: win.document, Element: win.Element, Node: win.Node,
      HTMLElement: win.HTMLElement, HTMLInputElement: win.HTMLInputElement,
      MutationObserver: win.MutationObserver, Event: win.Event, CustomEvent: win.CustomEvent,
      KeyboardEvent: win.KeyboardEvent, MouseEvent: win.MouseEvent, FocusEvent: win.FocusEvent, ResizeObserver: (win as unknown as { ResizeObserver?: unknown }).ResizeObserver, PointerEvent: (win as unknown as { PointerEvent?: unknown }).PointerEvent,
      AbortController: win.AbortController, AbortSignal: win.AbortSignal,
      customElements: win.customElements, getComputedStyle: win.getComputedStyle.bind(win),
      requestAnimationFrame: win.requestAnimationFrame.bind(win),
      cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
    };
    for (const [key, value] of Object.entries(globals)) {
      original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
  });
  afterEach(async () => {
    dom.window.close();
    await Promise.resolve();
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
}
