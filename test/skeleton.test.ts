// test/skeleton.test.ts
//
// The skeleton primitive and the layout integration, as the spec note's unit
// plan fixes them (skeleton-spec.md section 13). DOM work runs in jsdom; the
// geometry and theme work is the browser check's (scripts/check-skeleton.mjs).

import { beforeAll, afterAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";

let dom: JSDOM;
const originalDocument = globalThis.document;

beforeAll(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  (globalThis as any).document = dom.window.document;
  (globalThis as any).Element = dom.window.Element;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
  // The wave reads geometry on the frame after connect; give the module the
  // jsdom frame, as the browser would give it its own.
  (globalThis as any).requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  (globalThis as any).getComputedStyle = dom.window.getComputedStyle;
});

afterAll(() => {
  (globalThis as any).document = originalDocument;
});

describe("skeleton primitive", () => {
  test("defaults: text, medium, one line, wave, busy root, hidden shape", async () => {
    const { createSkeleton } = await import("../src/components/skeleton");
    const skeleton = createSkeleton();
    expect(skeleton.element.className).toBe("mtrl-skeleton");
    expect(skeleton.getVariant()).toBe("text");
    expect(skeleton.getSize()).toBe("medium");
    expect(skeleton.getLines()).toBe(1);
    expect(skeleton.getMotion()).toBe("wave");
    expect(skeleton.element.getAttribute("aria-busy")).toBe("true");
    const shape = skeleton.element.querySelector(".mtrl-skeleton__shape");
    expect(shape?.getAttribute("aria-hidden")).toBe("true");
    // One line is the shape itself; bars exist only for lines > 1
    expect(shape?.querySelectorAll(".mtrl-skeleton__line").length).toBe(0);
    skeleton.destroy();
  });

  test("lines: 3 renders three bars; circle and rect ignore lines", async () => {
    const { createSkeleton } = await import("../src/components/skeleton");
    const text = createSkeleton({ variant: "text", lines: 3 });
    expect(text.element.querySelectorAll(".mtrl-skeleton__line").length).toBe(3);
    text.setLines(2);
    expect(text.element.querySelectorAll(".mtrl-skeleton__line").length).toBe(2);
    text.destroy();

    const circle = createSkeleton({ variant: "circle", lines: 3 });
    expect(circle.element.querySelectorAll(".mtrl-skeleton__line").length).toBe(0);
    expect(circle.getLines()).toBe(3); // stored, ignored by the shape
    circle.destroy();
  });

  test("unknown variant, size and motion fall back to the defaults", async () => {
    const { createSkeleton } = await import("../src/components/skeleton");
    const skeleton = createSkeleton({ variant: "blob", size: "giant", motion: "glow" });
    expect(skeleton.getVariant()).toBe("text");
    expect(skeleton.getSize()).toBe("medium");
    expect(skeleton.getMotion()).toBe("wave");
    skeleton.destroy();
  });

  test("busy: setBusy(false) removes aria-busy and no-busy stays off", async () => {
    const { createSkeleton } = await import("../src/components/skeleton");
    const skeleton = createSkeleton({ busy: false });
    expect(skeleton.element.hasAttribute("aria-busy")).toBe(false);
    expect(skeleton.isBusy()).toBe(false);
    skeleton.setBusy(true);
    expect(skeleton.element.getAttribute("aria-busy")).toBe("true");
    skeleton.destroy();
  });

  test("multi-line text sizes the root to the line count", async () => {
    const { createSkeleton } = await import("../src/components/skeleton");
    const three = createSkeleton({ variant: "text", lines: 3 });
    expect(three.element.style.getPropertyValue("--mtrl-skeleton-line-count")).toBe("3");
    expect(three.element.dataset.lines).toBe("multi");
    three.setLines(1);
    expect(three.element.style.getPropertyValue("--mtrl-skeleton-line-count")).toBe("1");
    expect(three.element.dataset.lines).toBeUndefined();
    three.destroy();
    const circle = createSkeleton({ variant: "circle", lines: 3 });
    expect(circle.element.style.getPropertyValue("--mtrl-skeleton-line-count")).toBe("1");
    circle.destroy();
  });

  test("blockSize and inlineSize write their tokens", async () => {
    const { createSkeleton } = await import("../src/components/skeleton");
    const skeleton = createSkeleton({ variant: "rect", blockSize: "56px", inlineSize: "200px" });
    expect(skeleton.element.style.getPropertyValue("--mtrl-skeleton-block-size")).toBe("56px");
    expect(skeleton.element.style.getPropertyValue("--mtrl-skeleton-inline-size")).toBe("200px");
    skeleton.destroy();
  });

  test("the wave computes when the skeleton is appended after creation", async () => {
    const { createSkeleton } = await import("../src/components/skeleton");
    const skeleton = createSkeleton({ variant: "rect" });
    expect(skeleton.element.style.getPropertyValue("--mtrl-skeleton-delay")).toBe("");
    document.body.appendChild(skeleton.element);
    // The read happens on the first frame after the element is connected,
    // not only on the first frame after creation.
    const frame = (globalThis as any).requestAnimationFrame as (cb: () => void) => number;
    await new Promise((resolve) => frame(() => frame(resolve)));
    expect(skeleton.element.style.getPropertyValue("--mtrl-skeleton-delay")).toMatch(/ms$/);
    skeleton.destroy();
  });

  test("data attributes carry variant, size and motion for the stylesheet", async () => {
    const { createSkeleton } = await import("../src/components/skeleton");
    const skeleton = createSkeleton({ variant: "circle", size: "large", motion: "pulse" });
    expect(skeleton.element.dataset.variant).toBe("circle");
    expect(skeleton.element.dataset.size).toBe("large");
    expect(skeleton.element.dataset.motion).toBe("pulse");
    skeleton.destroy();
  });
});

describe("creator map", () => {
  test("registerSkeleton maps a creator's options; unknown creators are a rect", async () => {
    const { registerSkeleton, skeletonFor } = await import("../src/components/skeleton/map");
    const avatarCreator = (options: any) => ({ element: document.createElement("div"), ...options });
    registerSkeleton(avatarCreator, (options) => ({ variant: "circle", size: options.size ?? "large" }));
    expect(skeletonFor(avatarCreator, {})).toEqual({ variant: "circle", size: "large" });
    expect(skeletonFor(avatarCreator, { size: "small" })).toEqual({ variant: "circle", size: "small" });
    const unknown = (options: any) => ({ element: document.createElement("div"), ...options });
    expect(skeletonFor(unknown, {})).toEqual({ variant: "rect" });
  });
});

describe("layout integration", () => {
  test("skeleton mode does not call a registered creator; layout classes land on the host", async () => {
    const { createLayout } = await import("../src/core/layout");
    const element = document.createElement("div");
    document.body.appendChild(element);
    let calls = 0;
    const creator = (options: any) => {
      calls++;
      const node = document.createElement("button");
      node.className = "real-button";
      node.textContent = options.label ?? "Save";
      return { element: node, destroy: () => node.remove() };
    };
    const result = createLayout(
      [creator, "save", { label: "Save", layoutItem: { span: 6 }, layout: { type: "row", gap: 8 } }],
      element,
      { skeleton: true },
    );
    expect(calls).toBe(0);
    const host = result.get("save").element as HTMLElement;
    expect(host.className).toContain("mtrl-skeleton-host");
    expect(host.className).toContain("mtrl-layout__item");
    expect(host.querySelector(".mtrl-skeleton")).toBeTruthy();
    // The region carries busy; the placeholder inside it does not
    expect(element.getAttribute("aria-busy")).toBe("true");
    expect(host.querySelector(".mtrl-skeleton")?.hasAttribute("aria-busy")).toBe(false);
    result.destroy();
  });

  test("a plain div in the schema is still a real element", async () => {
    const { createLayout } = await import("../src/core/layout");
    const element = document.createElement("div");
    document.body.appendChild(element);
    const result = createLayout(["div", { class: "plain", textContent: "real" }], element, { skeleton: true });
    expect(result.element.className).toBe("plain");
    expect(result.element.textContent).toBe("real");
    element.remove();
  });

  test("reveal() replaces the host with the real component, carrying the layout classes", async () => {
    const { createLayout } = await import("../src/core/layout");
    const element = document.createElement("div");
    document.body.appendChild(element);
    const creator = (options: any) => ({
      element: Object.assign(document.createElement("button"), { textContent: options.label }),
      destroy: () => {},
    });
    const result = createLayout([creator, "save", { label: "Save", layoutItem: { span: 6 } }], element, { skeleton: true });
    const host = result.get("save").element as HTMLElement;
    const classesBefore = host.className;
    expect(host.querySelector(".mtrl-skeleton")).toBeTruthy();
    result.reveal();
    // The host leaves the layout: the slot's element is the real component,
    // in the document at the host's position, wearing the layout classes.
    const real = result.get("save").element as HTMLElement;
    expect(real.tagName).toBe("BUTTON");
    expect(real.textContent).toBe("Save");
    expect(real.className).toContain("mtrl-layout__item");
    expect(classesBefore).toContain("mtrl-layout__item");
    expect(host.isConnected).toBe(false);
    expect(real.querySelector(".mtrl-skeleton")).toBe(null);
    expect(element.hasAttribute("aria-busy")).toBe(false);
    result.destroy();
  });

  test("a single-component layout's root references follow the real element after reveal", async () => {
    const { createLayout } = await import("../src/core/layout");
    const element = document.createElement("div");
    document.body.appendChild(element);
    const creator = (options: any) => ({
      element: Object.assign(document.createElement("button"), { textContent: options.label }),
      destroy: () => {},
    });
    const result = createLayout([creator, "save", { label: "Save" }], element, { skeleton: true });
    const host = result.get("save").element as HTMLElement;
    expect(result.element).toBe(host);
    expect(result.layout.element).toBe(host);
    result.reveal();
    const real = result.get("save").element as HTMLElement;
    expect(result.element).toBe(real);
    expect(result.layout.element).toBe(real);
    expect(result.element.isConnected).toBe(true);
    expect(host.isConnected).toBe(false);
    result.destroy();
  });

  test("skeleton(schema, parent) matches the options call; an unknown creator is a rect", async () => {
    const { default: createLayout, skeleton } = await import("../src/core/layout");
    void createLayout;
    const element = document.createElement("div");
    document.body.appendChild(element);
    const creator = (options: any) => ({ element: document.createElement("input"), ...options });
    const result = skeleton([creator, "field", {}], element);
    const placeholder = result.get("field").element.querySelector(".mtrl-skeleton") as HTMLElement;
    expect(placeholder.dataset.variant).toBe("rect");
    element.remove();
  });

  test("form forwards the flag only when its config asks for it", async () => {
    const source = await Bun.file("src/components/form/features/layout.ts").text();
    expect(source).toContain("createLayout(schema, form, { skeleton: config.skeleton === true })");
  });
});

describe("jsx integration", () => {
  test("h() stands a function component in as its placeholder; string tags stay real", async () => {
    const { h } = await import("../src/core/layout/jsx");
    const creator = (options: any) => ({ element: document.createElement("button"), ...options });
    const stoodIn = h(creator, { skeleton: true }) as any;
    expect(stoodIn.element.className).toContain("mtrl-skeleton-host");
    expect(typeof stoodIn.reveal).toBe("function");
    const real = stoodIn.reveal();
    expect(real.element.tagName).toBe("BUTTON");
    const div = h("div", { skeleton: true }) as HTMLElement;
    expect(div.tagName).toBe("DIV");
  });
});
