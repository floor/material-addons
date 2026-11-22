import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { definePaginator } from "../../src/elements/paginator";

// The element's class is built once against one realm, so the registry and
// the globals must not change between tests
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
  definePaginator();
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

interface PaginatorHost extends HTMLElement {
  component: import("../../src/components/paginator").PaginatorComponent | null;
  page: number;
  pageSize: number;
  total: number;
  numbered: boolean;
  pageSizes: number[];
  goTo: (page: number) => boolean;
  setPage: (page: number) => unknown;
  setTotal: (total: number) => unknown;
}

const mount = (attributes = ""): PaginatorHost => {
  document.body.innerHTML = `<m-paginator ${attributes}></m-paginator>`;
  return document.querySelector("m-paginator") as PaginatorHost;
};

describe("<m-paginator>", () => {

  test("the attributes build the model and reflect after silent writes", () => {
    const host = mount('page="2" page-size="25" total="100"');
    const component = host.component!;
    expect([component.getPage(), component.getPageSize(), component.getTotal()]).toEqual([2, 25, 100]);
    expect(host.getAttribute("page")).toBe("2");
    host.setPage(3);
    expect(host.getAttribute("page")).toBe("3");
    host.setTotal(25);
    expect(host.getAttribute("page")).toBe("1");
    expect(host.getAttribute("total")).toBe("25");
  });

  test("page and page size are numbers on the host", () => {
    const host = mount('total="100"');
    expect(host.page).toBe(1);
    host.page = 2;
    expect(host.component!.getPage()).toBe(2);
    host.pageSize = 50;
    expect(host.component!.getPageSize()).toBe(50);
    host.total = 200;
    expect(host.component!.getTotal()).toBe(200);
  });

  test("pageSizes is a property, not an attribute", () => {
    const host = mount('total="100"');
    host.pageSizes = [5, 15];
    const options = [...host.component!.select.options].map((option) => option.value);
    // The current size stays selectable even though the list omits it
    expect(options).toEqual(["5", "15", "25"]);
    expect(host.getAttribute("page-sizes")).toBe(null);
  });

  test("change is cancelable and carries page and pageSize only", () => {
    const host = mount('total="100"');
    const detail: unknown[] = [];
    let cancel = false;
    host.addEventListener("change", (event) => {
      detail.push((event as CustomEvent).detail);
      if (cancel) event.preventDefault();
    });
    const next = host.shadowRoot!.querySelector(".mtrl-paginator__button--next") as HTMLButtonElement;
    next.click();
    expect(detail).toEqual([{ page: 2, pageSize: 25 }]);
    expect(host.component!.getPage()).toBe(2);
    cancel = true;
    next.click();
    expect(host.component!.getPage()).toBe(2);
    expect(host.getAttribute("page")).toBe("2");
  });

  test("numbered and no-ends reach the DOM", () => {
    const numbered = mount('total="500" page="10" numbered');
    expect(numbered.component!.getPageCount()).toBe(20);
    expect(numbered.shadowRoot!.querySelectorAll(".mtrl-paginator__page").length).toBeGreaterThan(0);
    const plain = mount('total="100" no-ends');
    const buttons = [...plain.shadowRoot!.querySelectorAll(".mtrl-paginator__button")] as HTMLButtonElement[];
    expect(buttons[0]!.hidden).toBe(true);
    expect(buttons[3]!.hidden).toBe(true);
  });

  test("disabled disables the select and every button", () => {
    const host = mount('total="100" disabled');
    const component = host.component!;
    expect(component.isDisabled()).toBe(true);
    expect(component.select.disabled).toBe(true);
    expect([...host.shadowRoot!.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
    host.removeAttribute("disabled");
    expect(component.isDisabled()).toBe(false);
  });

  test("the method surface forwards to the factory", () => {
    const host = mount('total="100"');
    expect(host.goTo(2)).toBe(true);
    expect(host.getPage()).toBe(2);
    expect(host.getPageCount()).toBe(4);
  });
});
