import { describe, expect, test } from "bun:test";
import { createBreadcrumb } from "../../src/components/breadcrumb";
import { installAutocompleteDom } from "../utils/autocomplete-dom";

const items = [
  { value: "home", label: "Home", href: "/" },
  { value: "rooms", label: "Rooms", href: "/rooms" },
  { value: "chair", label: "Chair" },
];

describe("createBreadcrumb", () => {
  installAutocompleteDom();

  test("renders an ordered list with separators and one current page", () => {
    const crumb = createBreadcrumb({ items });
    document.body.append(crumb.element);
    expect(crumb.element.localName).toBe("nav");
    expect(crumb.element.getAttribute("aria-label")).toBe("Breadcrumb");
    const list = crumb.element.querySelector("ol")!;
    expect(list.children).toHaveLength(3);
    expect(list.querySelectorAll(".mtrl-breadcrumb__separator")).toHaveLength(2);
    expect(list.querySelectorAll("a")).toHaveLength(2);
    expect(list.querySelectorAll(".mtrl-breadcrumb__current")).toHaveLength(1);
    expect(crumb.getValue()).toBe("chair");
    expect(crumb.element.querySelector('[aria-current="page"]')?.textContent).toBe("Chair");
    crumb.destroy();
  });

  test("an ancestor without href is a button; the current item is never a link", () => {
    const crumb = createBreadcrumb({ items: [{ value: "a", label: "A", href: "/a" }, { value: "b", label: "B", href: "/b" }, { value: "c", label: "C", href: "/c" }] });
    document.body.append(crumb.element);
    const list = crumb.element.querySelector("ol")!;
    expect(list.children[0]!.querySelector("a")).not.toBeNull();
    expect(list.children[2]!.querySelector("span[aria-current]")).not.toBeNull();
    expect(list.children[2]!.querySelector("a")).toBeNull();
    crumb.destroy();
  });

  test("goTo emits beforechange then change, and a veto stops it", () => {
    const crumb = createBreadcrumb({ items });
    document.body.append(crumb.element);
    const seen: string[] = [];
    crumb.on("beforechange", (event) => {
      seen.push(`before:${event.value}:${event.previousValue}`);
      if (event.value === "rooms") event.preventDefault();
    });
    crumb.on("change", (event) => seen.push(`change:${event.value}:${event.previousValue}`));
    expect(crumb.goTo("rooms")).toBe(false);
    expect(seen).toEqual(["before:rooms:chair"]);
    expect(crumb.goTo("home")).toBe(true);
    expect(seen).toEqual(["before:rooms:chair", "before:home:chair", "change:home:chair"]);
    expect(crumb.getValue()).toBe("chair");
    crumb.destroy();
  });

  test("a disabled item, a disabled trail and the current item do not emit", () => {
    const crumb = createBreadcrumb({ items: [{ value: "a", label: "A", disabled: true }, { value: "b", label: "B" }, { value: "c", label: "C" }] });
    document.body.append(crumb.element);
    const seen: string[] = [];
    crumb.on("beforechange", () => seen.push("beforechange"));
    expect(crumb.goTo("a")).toBe(false);
    expect(crumb.goTo("c")).toBe(false);
    crumb.disable();
    expect(crumb.goTo("b")).toBe(false);
    expect(seen).toEqual([]);
    crumb.destroy();
  });

  test("setItems and setValue are silent, and setValue takes only the last item", () => {
    const crumb = createBreadcrumb({ items });
    document.body.append(crumb.element);
    const seen: string[] = [];
    crumb.on("beforechange", () => seen.push("beforechange"));
    crumb.on("change", () => seen.push("change"));
    crumb.setItems([{ value: "home", label: "Home" }, { value: "desk", label: "Desk" }]);
    expect(crumb.getValue()).toBe("desk");
    crumb.setValue("home");
    expect(crumb.getValue()).toBe("desk");
    crumb.setValue("desk");
    expect(crumb.getValue()).toBe("desk");
    expect(seen).toEqual([]);
    const empty = createBreadcrumb({ items: [] });
    expect(empty.getValue()).toBeNull();
    empty.destroy();
    crumb.destroy();
  });

  test("the overflow is absent with two items and with no-collapse", () => {
    const two = createBreadcrumb({ items: items.slice(1) });
    document.body.append(two.element);
    expect(two.element.querySelector(".mtrl-breadcrumb__item--overflow")).toBeNull();
    two.open();
    expect(two.isOpen()).toBe(false);
    const plain = createBreadcrumb({ items, collapse: false });
    document.body.append(plain.element);
    expect(plain.element.querySelector(".mtrl-breadcrumb__item--overflow")).toBeNull();
    two.destroy();
    plain.destroy();
  });

  test("focus leaving the menu closes it without pulling focus back", () => {
    const crumb = createBreadcrumb({ items: [...items, { value: "desk", label: "Desk" }] });
    document.body.append(crumb.element);
    const list = crumb.element.querySelector("ol")!;
    Object.defineProperty(crumb.element, "clientWidth", { value: 120, configurable: true });
    Object.defineProperty(list, "scrollWidth", { value: 600, configurable: true });
    crumb.setItems(crumb.getItems().map((item) => ({ value: item.value, label: item.label })));
    crumb.open();
    expect(crumb.isOpen()).toBe(true);
    const overflow = crumb.element.querySelector(".mtrl-breadcrumb__item--overflow")!;
    const menuitem = overflow.querySelector('[role="menuitem"]') as HTMLElement;
    menuitem.focus();
    // A focus move inside the overflow keeps it open
    const overflowButton = overflow.querySelector(".mtrl-breadcrumb__overflow") as HTMLElement;
    menuitem.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true, relatedTarget: overflowButton }));
    expect(crumb.isOpen()).toBe(true);
    // A focus move out of the overflow closes it
    menuitem.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true, relatedTarget: document.body }));
    expect(crumb.isOpen()).toBe(false);
    expect(overflow.querySelector(".mtrl-breadcrumb__menu")?.hasAttribute("hidden")).toBe(true);
    crumb.destroy();
  });

  test("the overflow item sits inside the list, after the first item", () => {
    const crumb = createBreadcrumb({ items: items.slice(0, 3).concat([{ value: "desk", label: "Desk" }]) });
    document.body.append(crumb.element);
    const list = crumb.element.querySelector("ol")!;
    // The measurement needs a layout jsdom has none of: give it one
    Object.defineProperty(crumb.element, "clientWidth", { value: 120, configurable: true });
    Object.defineProperty(list, "scrollWidth", { value: 600, configurable: true });
    crumb.setItems(crumb.getItems().map((item) => ({ value: item.value, label: item.label })));
    const overflow = crumb.element.querySelector(".mtrl-breadcrumb__item--overflow");
    expect(overflow).not.toBeNull();
    expect(overflow!.parentElement).toBe(list);
    expect(Array.from(list.children).indexOf(overflow as HTMLLIElement)).toBe(1);
    expect(overflow!.hasAttribute("hidden")).toBe(false);
    // A row that fits has no overflow item at all
    Object.defineProperty(list, "scrollWidth", { value: 60, configurable: true });
    crumb.setItems(crumb.getItems().map((item) => ({ value: item.value, label: item.label })));
    expect(crumb.element.querySelector(".mtrl-breadcrumb__item--overflow")).toBeNull();
    crumb.destroy();
  });
});
