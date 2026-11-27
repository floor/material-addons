// test/components/data-grid.test.ts

import { beforeEach, describe, expect, test } from "bun:test";
import { installDom } from "../utils/dom";

// jsdom has no ResizeObserver and no layout. vlist observes its viewport and
// builds the header on the observation, so the stub reports one 800x400 box;
// the realm's elements report the same box from getBoundingClientRect and the
// client sizes, which is what a mounted grid measures in a browser
class TestResizeObserver {
  constructor(private callback: (entries: unknown[]) => void) {}
  observe(target: Element): void {
    const rect = () => ({ width: 800, height: 400, top: 0, left: 0, right: 800, bottom: 400, x: 0, y: 0, toJSON: () => rect() });
    setTimeout(
      () =>
        this.callback([
          {
            target,
            contentRect: rect(),
            borderBoxSize: [{ blockSize: 400, inlineSize: 800 }],
            contentBoxSize: [{ blockSize: 400, inlineSize: 800 }],
          },
        ]),
      0,
    );
  }
  unobserve(): void {}
  disconnect(): void {}
}

import { createDataGrid } from "../../src/components/data-grid";
import { alignFor } from "../../src/components/data-grid/columns";

installDom();

beforeEach(() => {
  Object.defineProperty(globalThis, "ResizeObserver", { value: TestResizeObserver, configurable: true, writable: true });
  const prototype = window.Element.prototype as unknown as { getBoundingClientRect: () => unknown };
  prototype.getBoundingClientRect = () => ({
    x: 0, y: 0, top: 0, left: 0, width: 800, height: 400, right: 800, bottom: 400, toJSON() { return this; },
  });
  for (const [key, value] of [
    ["clientWidth", 800], ["clientHeight", 400], ["offsetWidth", 800], ["offsetHeight", 400],
    ["scrollWidth", 800], ["scrollHeight", 100000],
  ] as const) {
    Object.defineProperty(window.HTMLElement.prototype, key, { configurable: true, get: () => value });
  }
});

// vlist reads the document and measures the viewport while it builds; the
// fixture installs a realm per test, and each grid gets a sized viewport

const size = (element: Element, width: number, height: number): void => {
  Object.defineProperty(element, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: height, configurable: true });
  Object.defineProperty(element, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(element, "offsetHeight", { value: height, configurable: true });
  Object.defineProperty(element, "scrollHeight", { value: height, configurable: true });
};
const measure = (grid: { element: HTMLElement }): void => {
  for (const node of Array.from(grid.element.querySelectorAll<HTMLElement>(".vlist, .vlist-viewport, .vlist-content"))) {
    size(node, 800, 400);
  }
};

const columns = [
  { key: "name", label: "Name", sortable: true },
  { key: "role", label: "Role" },
];

const items = [
  { id: "2", name: "Bravo", role: "Beta" },
  { id: "1", name: "Alpha", role: "Alpha" },
  { id: "3", name: "Charlie", role: "Gamma" },
];

const headerCell = (grid: { element: HTMLElement }, index: number): HTMLElement =>
  grid.element.querySelectorAll<HTMLElement>(".vlist-table-header [role='columnheader']")[index]!;

const rowIds = (grid: { element: HTMLElement }): string[] =>
  Array.from(grid.element.querySelectorAll(".vlist-table-row")).map((row) => row.getAttribute("data-id") ?? "");

const mount = async (config: Parameters<typeof createDataGrid>[0]) => {
  const grid = createDataGrid(config);
  document.body.append(grid.element);
  measure(grid);
  // The viewport observation builds the header cells and the first rows
  await new Promise((resolve) => setTimeout(resolve, 20));
  return grid;
};

describe("createDataGrid", () => {
  test("defaults: display only, density 0, the grid roles vlist writes", async () => {
    const grid = await mount({ columns, items, ariaLabel: "People" });
    const list = grid.element.querySelector(".vlist")!;
    expect(list.getAttribute("role")).toBe("grid");
    expect(list.getAttribute("aria-label")).toBe("People");
    expect(list.hasAttribute("tabindex")).toBe(false);
    expect(grid.getValue()).toBeNull();
    expect(grid.getValues()).toEqual([]);
    expect(grid.element.querySelectorAll("m-checkbox").length).toBe(0);
    const headerRow = grid.element.querySelector(".vlist-table-header")!;
    expect(headerRow.getAttribute("role")).toBe("row");
    expect(headerRow.parentElement!.getAttribute("role")).toBe("rowgroup");
    expect(headerCell(grid, 0).getAttribute("role")).toBe("columnheader");
    grid.destroy();
  });

  test("density sets the header and row heights", async () => {
    const dense = await mount({ columns, items, density: -3 });
    const denseRoot = dense.element.querySelector(".vlist") as HTMLElement;
    expect(denseRoot.style.getPropertyValue("--vlist-table-header-height")).toBe("44px");
    expect((dense.element.querySelector(".vlist-table-row") as HTMLElement).style.height).toBe("40px");
    dense.destroy();

    const regular = await mount({ columns, items });
    const regularRoot = regular.element.querySelector(".vlist") as HTMLElement;
    expect(regularRoot.style.getPropertyValue("--vlist-table-header-height")).toBe("56px");
    expect((regular.element.querySelector(".vlist-table-row") as HTMLElement).style.height).toBe("52px");
    regular.destroy();
  });

  test("a sortable header cycles asc, desc and clears", async () => {
    const grid = await mount({ columns, items });
    headerCell(grid, 0).click();
    expect(grid.getSort()).toEqual({ key: "name", direction: "asc" });
    expect(headerCell(grid, 0).getAttribute("aria-sort")).toBe("ascending");
    expect(rowIds(grid)).toEqual(["1", "2", "3"]);
    headerCell(grid, 0).click();
    expect(grid.getSort()).toEqual({ key: "name", direction: "desc" });
    expect(headerCell(grid, 0).getAttribute("aria-sort")).toBe("descending");
    expect(rowIds(grid)).toEqual(["3", "2", "1"]);
    headerCell(grid, 0).click();
    expect(grid.getSort()).toEqual({ key: null, direction: null });
    expect(headerCell(grid, 0).hasAttribute("aria-sort")).toBe(false);
    expect(rowIds(grid)).toEqual(["2", "1", "3"]);
    grid.destroy();
  });

  test("a vetoed sort keeps the previous order and indicator", async () => {
    const grid = await mount({ columns, items });
    let vetoed = 0;
    grid.on("sort", ((payload: { preventDefault: () => void }) => {
      vetoed += 1;
      payload.preventDefault();
    }) as never);
    headerCell(grid, 0).click();
    expect(vetoed).toBe(1);
    expect(grid.getSort()).toEqual({ key: null, direction: null });
    expect(headerCell(grid, 0).hasAttribute("aria-sort")).toBe(false);
    expect(rowIds(grid)).toEqual(["2", "1", "3"]);
    grid.destroy();
  });

  test("a custom compare replaces the default", async () => {
    const grid = await mount({
      columns,
      items,
      sort: (rows, _key, direction) => (direction === "asc" ? [...rows].reverse() : rows),
    });
    grid.setSort("name", "asc");
    expect(rowIds(grid)).toEqual(["3", "1", "2"]);
    grid.destroy();
  });

  test("multiple selection: row checkboxes, the header checkbox and the change detail", async () => {
    const grid = await mount({ columns, items, selection: "multiple" });
    const changes: Array<{ value: string | null; values: string[] }> = [];
    grid.on("change", ((payload: { value: string | null; values: string[] }) => changes.push({ ...payload })) as never);
    const checkboxes = () => Array.from(grid.element.querySelectorAll<HTMLElement>(".vlist-table-row m-checkbox"));
    expect(grid.element.querySelectorAll(".vlist-table-header m-checkbox").length).toBe(1);
    checkboxes()[0]!.dispatchEvent(new window.CustomEvent("change", { bubbles: true }));
    expect(grid.getValues()).toEqual(["2"]);
    expect(changes.at(-1)).toEqual({ value: "2", values: ["2"] });
    const headerBox = grid.element.querySelector(".vlist-table-header m-checkbox")!;
    expect(headerBox.hasAttribute("indeterminate")).toBe(true);
    expect(headerBox.hasAttribute("checked")).toBe(false);
    headerBox.dispatchEvent(new window.CustomEvent("change", { bubbles: true }));
    expect(grid.getValues().sort()).toEqual(["1", "2", "3"]);
    expect(grid.element.querySelector(".vlist-table-header m-checkbox")!.hasAttribute("checked")).toBe(true);
    expect(grid.element.querySelector(".vlist-table-header m-checkbox")!.hasAttribute("indeterminate")).toBe(false);
    grid.element.querySelector(".vlist-table-header m-checkbox")!.dispatchEvent(new window.CustomEvent("change", { bubbles: true }));
    expect(grid.getValues()).toEqual([]);
    expect(changes.at(-1)).toEqual({ value: null, values: [] });
    grid.destroy();
  });

  test("single selection keeps one id and has no header checkbox", async () => {
    const grid = await mount({ columns, items, selection: "single" });
    expect(grid.element.querySelector(".vlist-table-header m-checkbox")).toBeNull();
    const checkboxes = Array.from(grid.element.querySelectorAll<HTMLElement>(".vlist-table-row m-checkbox"));
    checkboxes[0]!.dispatchEvent(new window.CustomEvent("change", { bubbles: true }));
    checkboxes[1]!.dispatchEvent(new window.CustomEvent("change", { bubbles: true }));
    expect(grid.getValues()).toEqual(["1"]);
    grid.destroy();
  });

  test("the selection column is not sortable and its controls are not tab stops", async () => {
    const grid = await mount({ columns, items, selection: "multiple" });
    const selectHeader = headerCell(grid, 0);
    expect(selectHeader.textContent).not.toContain("▲");
    selectHeader.click();
    expect(grid.getSort()).toEqual({ key: null, direction: null });
    const boxes = Array.from(grid.element.querySelectorAll("m-checkbox"));
    expect(boxes.length).toBeGreaterThan(1);
    for (const box of boxes) expect(box.getAttribute("tabindex")).toBe("-1");
    grid.destroy();
  });

  test("selection none: no checkbox column and no tab stop on the grid", async () => {
    const grid = await mount({ columns, items, selection: "none" });
    expect(grid.element.querySelectorAll("m-checkbox").length).toBe(0);
    expect(grid.element.querySelector(".vlist")!.hasAttribute("tabindex")).toBe(false);
    grid.destroy();
  });

  test("the namespaced methods read and write", async () => {
    const grid = await mount({ columns, items, selection: "multiple" });
    expect(grid.element.querySelector<HTMLElement>(".vlist-table-cell[tabindex='0']")).not.toBeNull();
    grid.setValues(["1", "3"]);
    expect(grid.getValues().sort()).toEqual(["1", "3"]);
    expect(grid.getValue()).toBe("3");
    grid.setValue("2");
    expect(grid.getValues()).toEqual(["2"]);
    grid.destroy();
  });

  test("the body holds one tab stop, the active cell, in every selection mode", async () => {
    for (const selection of ["none", "single", "multiple"] as const) {
      const grid = await mount({ columns, items, selection });
      const stops = Array.from(grid.element.querySelectorAll<HTMLElement>(".vlist-table-cell")).filter((cell) => cell.tabIndex === 0);
      expect(stops.length).toBe(1);
      expect(grid.element.querySelector(".vlist")!.hasAttribute("tabindex")).toBe(false);
      grid.destroy();
    }
  });

  test("the arrows move the active cell by column in the reading order", async () => {
    const grid = await mount({ columns, items });
    const active = async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      const cell = grid.element.querySelector<HTMLElement>(".vlist-table-cell[tabindex='0']");
      return cell ? Array.from(cell.parentElement!.querySelectorAll(".vlist-table-cell")).indexOf(cell) : -1;
    };
    const press = async (key: string) => {
      grid.element.querySelector<HTMLElement>(".vlist-table-cell[tabindex='0']")!.dispatchEvent(
        new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 30));
    };
    expect(await active()).toBe(0);
    await press("ArrowRight");
    expect(await active()).toBe(1);
    await press("ArrowRight");
    expect(await active()).toBe(1);
    await press("ArrowLeft");
    expect(await active()).toBe(0);
    await press("End");
    expect(await active()).toBe(1);
    await press("Home");
    expect(await active()).toBe(0);
    grid.destroy();
  });

  test("the arrows mirror under RTL", async () => {
    document.documentElement.dir = "rtl";
    try {
      const grid = await mount({ columns, items, selection: "multiple" });
      const press = async (key: string) => {
        grid.element.querySelector<HTMLElement>(".vlist-table-cell[tabindex='0']")!.dispatchEvent(
          new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
        );
        await new Promise((resolve) => setTimeout(resolve, 30));
      };
      await press("ArrowRight");
      const cell = grid.element.querySelector<HTMLElement>(".vlist-table-cell[tabindex='0']")!;
      const index = Array.from(cell.parentElement!.querySelectorAll(".vlist-table-cell")).indexOf(cell);
      // reading order runs backwards in RTL: Right moves toward the row's start
      expect(index).toBe(0);
      grid.destroy();
    } finally {
      document.documentElement.removeAttribute("dir");
    }
  });

  test("Ctrl+Home and Ctrl+End reach the grid's corners", async () => {
    const grid = await mount({ columns, items: Array.from({ length: 40 }, (_, index) => ({ id: String(index + 1), name: `N${index + 1}`, role: "R" })) });
    const press = async (key: string, modifier = false) => {
      grid.element.querySelector<HTMLElement>(".vlist-table-cell[tabindex='0']")!.dispatchEvent(
        new window.KeyboardEvent("keydown", { key, ctrlKey: modifier, bubbles: true, cancelable: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 40));
    };
    await press("End", true);
    const cell = grid.element.querySelector<HTMLElement>(".vlist-table-cell[tabindex='0']");
    const row = cell?.closest<HTMLElement>(".vlist-table-row");
    expect(row?.getAttribute("data-index")).toBe("39");
    expect(Array.from(row!.querySelectorAll(".vlist-table-cell")).indexOf(cell!)).toBe(1);
    await press("Home", true);
    const first = grid.element.querySelector<HTMLElement>(".vlist-table-cell[tabindex='0']");
    expect(first?.closest<HTMLElement>(".vlist-table-row")?.getAttribute("data-index")).toBe("0");
    grid.destroy();
  });

  test("a reading-order alignment maps onto vlist's mirrored names", () => {
    // vlist mirrors the row in RTL, so `left` is the reading start there and
    // the Chromium check holds the rendered edge in both directions
    expect(alignFor("start")).toBe("left");
    expect(alignFor("end")).toBe("right");
    expect(alignFor("center")).toBe("center");
  });

  test("column widths include the selection column and it rejects resizing", async () => {
    const grid = await mount({ columns, items, selection: "single", columns: [{ key: "name", label: "Name", width: 200 }] });
    const widths = grid.getColumnWidths();
    expect(widths.select).toBe(48);
    expect(widths.name).toBe(200);
    grid.resizeColumn("select", 300);
    expect(grid.getColumnWidths().select).toBe(48);
    grid.destroy();
  });

  test("disabled blocks the sort path", async () => {
    const grid = await mount({ columns, items });
    grid.disable();
    headerCell(grid, 0).click();
    expect(grid.getSort()).toEqual({ key: null, direction: null });
    expect(grid.isDisabled()).toBe(true);
    grid.enable();
    headerCell(grid, 0).click();
    expect(grid.getSort()).toEqual({ key: "name", direction: "asc" });
    grid.destroy();
  });
});
