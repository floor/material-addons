import { describe, expect, test } from "bun:test";
import { createPaginator } from "../../src/components/paginator";
import { installAutocompleteDom } from "../utils/autocomplete-dom";

const mount = (config = {}) => {
  const paginator = createPaginator(config);
  document.body.append(paginator.element);
  return paginator;
};

describe("createPaginator", () => {
  installAutocompleteDom();

  test("defaults: page 1, page size 25, one page, the 0–0 range", () => {
    const paginator = mount();
    expect(paginator.element.localName).toBe("nav");
    expect(paginator.element.getAttribute("aria-label")).toBe("Pagination");
    expect([paginator.getPage(), paginator.getPageSize(), paginator.getTotal(), paginator.getPageCount()]).toEqual([1, 25, 0, 1]);
    expect(paginator.getPageSizes()).toEqual([10, 25, 50, 100]);
    expect(paginator.getRange()).toEqual({ start: 0, end: 0, total: 0, page: 1, pageSize: 25 });
    expect(paginator.range.textContent).toBe("0–0 of 0");
    const buttons = [...paginator.element.querySelectorAll(".mtrl-paginator__button")] as HTMLButtonElement[];
    expect(buttons).toHaveLength(4);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "First page", "Previous page", "Next page", "Last page",
    ]);
    const options = [...paginator.select.options].map((option) => option.value);
    expect(options).toEqual(["10", "25", "50", "100"]);
    expect(paginator.select.value).toBe("25");
    paginator.destroy();
  });

  test("the range follows the page, and the ends disable at their edge", () => {
    const paginator = mount({ total: 100 });
    expect(paginator.range.textContent).toBe("1–25 of 100");
    expect(paginator.getPageCount()).toBe(4);
    expect(paginator.goTo(2)).toBe(true);
    expect(paginator.range.textContent).toBe("26–50 of 100");
    const [, prev, next, last] = [...paginator.element.querySelectorAll(".mtrl-paginator__button")] as HTMLButtonElement[];
    expect(prev!.disabled).toBe(false);
    paginator.goTo(4);
    expect(next!.disabled).toBe(true);
    expect(last!.disabled).toBe(true);
    expect(paginator.goTo(5)).toBe(false);
    paginator.setPage(1);
    expect(paginator.getPage()).toBe(1);
    paginator.destroy();
  });

  test("goTo is guarded and the beforechange veto stops the move", () => {
    const paginator = mount({ total: 100 });
    const seen: string[] = [];
    paginator.on("beforechange", (event) => {
      seen.push(`before:${event.page}`);
      if (event.page === 3) event.preventDefault();
    });
    paginator.on("change", (event) => seen.push(`change:${event.page}:${event.previousPage}`));
    expect(paginator.goTo(0)).toBe(false);
    expect(paginator.goTo(9)).toBe(false);
    expect(paginator.goTo(1)).toBe(false);
    expect(paginator.goTo(2)).toBe(true);
    expect(paginator.goTo(3)).toBe(false);
    expect(paginator.getPage()).toBe(2);
    expect(seen).toEqual(["before:2", "change:2:1", "before:3"]);
    paginator.destroy();
  });

  test("silent setters clamp without events", () => {
    const paginator = mount({ total: 200 });
    const events: string[] = [];
    paginator.on("beforechange", () => events.push("beforechange"));
    paginator.on("change", () => events.push("change"));
    paginator.setPageSize(50).setPage(3);
    expect([paginator.getPage(), paginator.getPageSize()]).toEqual([3, 50]);
    expect(events).toEqual([]);
    paginator.setTotal(40);
    expect(paginator.getPage()).toBe(1);
    paginator.setPage(4);
    expect(paginator.getPage()).toBe(1);
    paginator.setPageSize(10);
    expect(paginator.getPageCount()).toBe(4);
    expect(paginator.setPageSize(0)).toBe(paginator);
    expect(paginator.getPageSize()).toBe(10);
    paginator.destroy();
  });

  test("the select proposes page 1 and the size, and a veto restores the option", () => {
    const paginator = mount({ total: 100, page: 3 });
    const seen: Array<[number, number, number, number]> = [];
    paginator.on("beforechange", (event) => {
      seen.push([event.page, event.pageSize, event.previousPage, event.previousPageSize]);
      if (event.pageSize === 50) event.preventDefault();
    });
    const choose = (value: string): void => {
      paginator.select.value = value;
      paginator.select.dispatchEvent(new Event("change"));
    };
    choose("50");
    expect(seen).toEqual([[1, 50, 3, 25]]);
    expect([paginator.getPage(), paginator.getPageSize()]).toEqual([3, 25]);
    expect(paginator.select.value).toBe("25");
    choose("100");
    expect([paginator.getPage(), paginator.getPageSize()]).toEqual([1, 100]);
    expect(paginator.select.value).toBe("100");
    paginator.destroy();
  });

  test("numbered pages draw boundaries, siblings and one ellipsis per gap", () => {
    const paginator = mount({ total: 500, pageSize: 25, page: 10, numbered: true });
    const labels = [...paginator.element.querySelectorAll(".mtrl-paginator__page, .mtrl-paginator__ellipsis")].map(
      (node) => node.textContent,
    );
    expect(labels).toEqual(["1", "…", "9", "10", "11", "…", "20"]);
    const current = paginator.element.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe("10");
    expect(current?.getAttribute("aria-label")).toBe("Page 10");
    // A one-page gap is that page, not an ellipsis
    paginator.setPage(2);
    const near = [...paginator.element.querySelectorAll(".mtrl-paginator__page, .mtrl-paginator__ellipsis")].map(
      (node) => node.textContent,
    );
    expect(near).toEqual(["1", "2", "3", "…", "20"]);
    paginator.setPage(3);
    const filled = [...paginator.element.querySelectorAll(".mtrl-paginator__page, .mtrl-paginator__ellipsis")].map(
      (node) => node.textContent,
    );
    expect(filled).toEqual(["1", "2", "3", "4", "…", "20"]);
    paginator.setNumbered(false);
    expect(paginator.element.querySelector(".mtrl-paginator__pages")?.childElementCount).toBe(0);
    paginator.destroy();
  });

  test("no-ends keeps previous and next only through the factory ends option", () => {
    const paginator = mount({ total: 100, ends: false });
    const buttons = [...paginator.element.querySelectorAll(".mtrl-paginator__button")] as HTMLButtonElement[];
    expect(buttons.map((button) => button.hidden)).toEqual([true, false, false, true]);
    paginator.destroy();
  });

  test("a custom range and page label win over the defaults", () => {
    const paginator = mount({
      total: 100,
      numbered: true,
      formatRange: ({ start, end, total }) => `${start} to ${end} / ${total}`,
      pageLabel: (page) => `Go to ${page}`,
    });
    expect(paginator.range.textContent).toBe("1 to 25 / 100");
    expect(paginator.element.querySelector(".mtrl-paginator__page")?.getAttribute("aria-label")).toBe("Go to 1");
    paginator.destroy();
  });

  test("disable disables the select and every button", () => {
    const paginator = mount({ total: 100 });
    paginator.disable();
    expect(paginator.isDisabled()).toBe(true);
    expect(paginator.select.disabled).toBe(true);
    expect([...paginator.element.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
    expect(paginator.goTo(2)).toBe(false);
    paginator.enable();
    expect(paginator.select.disabled).toBe(false);
    expect(paginator.goTo(2)).toBe(true);
    paginator.destroy();
  });
});
