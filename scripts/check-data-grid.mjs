// What vlist's table gives the grid, seen in Chromium: the AX roles, the body
// and header keyboard, sorting from a header, selection from the keyboard and
// the header checkbox, and focus that survives virtualization. Light and dark,
// left to right and right to left.
//
//   bun run build --production && node scripts/check-data-grid.mjs
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";
import { MATERIAL_DEPS } from "./vite-deps.mjs";

const server = await createServer({
  configFile: false,
  optimizeDeps: { include: MATERIAL_DEPS, entries: ["test/browser/data-grid.html"], exclude: ["material-addons/svelte", "svelte"] },
  resolve: { conditions: ["svelte", "module", "browser", "development"] },
  cacheDir: "node_modules/.vite-data-grid",
  server: { host: "127.0.0.1", port: 0, hmr: false },
});
let browser;
try {
  await server.listen();
  const { port } = server.httpServer.address();
  const fixture = `http://127.0.0.1:${port}/test/browser/data-grid.html`;
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const reset = async (theme, direction) => {
    await page.goto(fixture);
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => !!window.dataGrid, {}, { timeout: 60000 });
    await page.evaluate(([mode, dir]) => {
      document.documentElement.dataset.themeMode = mode;
      document.documentElement.dir = dir;
      document.body.replaceChildren();
      // A focusable sibling, so Tab can enter the grid with keyboard focus
      const before = document.createElement("button");
      before.textContent = "before";
      document.body.append(before);
      const host = document.createElement("div");
      host.style.cssText = "width:720px;height:360px";
      document.body.append(host);
      const items = Array.from({ length: 200 }, (_, index) => ({
        id: String(index + 1),
        name: `Person ${String(index + 1).padStart(3, "0")}`,
        score: 200 - index,
      }));
      const columns = [
        { key: "name", label: "Name", sortable: true, width: 280 },
        { key: "score", label: "Score", sortable: true, align: "end", width: 120 },
      ];
      const plain = window.dataGrid.createDataGrid({ columns: [{ key: "name", label: "Name", sortable: true, width: 280 }], items, ariaLabel: "People" });
      host.append(plain.element);
      plain.list.style.height = "320px";
      const selectable = window.dataGrid.createDataGrid({ columns, items, selection: "multiple", ariaLabel: "Selectable people" });
      selectable.element.style.marginBlockStart = "16px";
      selectable.element.style.height = "320px";
      document.body.append(selectable.element);
      window.grids = { plain, selectable };
    }, [theme, direction]);
    await page.waitForTimeout(150);
  };

  const headerCell = (selector, index) => page.locator(`${selector} .vlist-table-header [role='columnheader']`).nth(index);
  const focusedId = () => page.evaluate(() => document.activeElement?.closest(".vlist")?.querySelector(".vlist-item--focused")?.getAttribute("data-id")
    ?? document.querySelector(".vlist-item--focused")?.getAttribute("data-id") ?? null);

  // (1) The grid roles are in the accessibility tree
  await reset("light", "ltr");
  const ax = await page.locator("body").ariaSnapshot();
  for (const role of ["grid", "row", "columnheader", "gridcell"]) {
    assert.ok(new RegExp(`^\\s*- ${role}\\b`, "m").test(ax), `the AX tree holds the ${role} role`);
  }

  for (const theme of ["light", "dark"]) {
    for (const direction of ["ltr", "rtl"]) {
      await reset(theme, direction);
      const label = `${theme}/${direction}`;

      // (2) Body navigation: ArrowDown, ArrowUp, Home, End, PageUp and
      //     PageDown move the focused row, which Space then selects. The body
      //     keyboard is vlist's selection model's, so it runs on the
      //     selectable grid; a display-only grid keeps the header's keys only.
      // Tab walks the button, the display-only grid's header and active cell,
      // and the selectable grid's header, into the selectable grid's cell
      const enterBody = async () => {
        await page.locator("button").first().focus();
        for (let press = 0; press < 8; press += 1) {
          await page.keyboard.press("Tab");
          await page.waitForTimeout(40);
          const inside = await page.evaluate(() => {
            const cell = document.activeElement?.closest?.(".vlist-table-cell");
            return Boolean(cell && window.grids.selectable.element.contains(cell));
          });
          if (inside) return true;
        }
        return false;
      };
      assert.equal(await enterBody(), true, `${label}: Tab enters the grid's active cell`);
      const press = async (keys) => {
        for (const key of keys) {
          await page.keyboard.press(key);
          await page.waitForTimeout(90);
        }
      };
      const selectedId = async () => {
        await page.keyboard.press("Space");
        await page.waitForTimeout(90);
        const values = await page.evaluate(() => window.grids.selectable.getValues());
        await page.evaluate(() => window.grids.selectable.setValues([]));
        return values.at(-1) ?? null;
      };
      // The active cell starts on the first row; the arrows step from there
      assert.equal(await selectedId(), "1", `${label}: the grid focuses the first row`);
      await press(["ArrowDown"]);
      assert.equal(await selectedId(), "2", `${label}: ArrowDown moves`);
      await press(["ArrowUp"]);
      assert.equal(await selectedId(), "1", `${label}: ArrowUp moves`);
      await press(["PageDown"]);
      const pageDownId = await selectedId();
      assert.ok(pageDownId && Number(pageDownId) > 1, `${label}: PageDown moves a viewport (${pageDownId})`);
      await press(["PageUp"]);
      assert.equal(await selectedId(), "1", `${label}: PageUp returns`);
      await press(["Control+End"]);
      const endId = await selectedId();
      assert.equal(endId, "200", `${label}: Ctrl+End reaches the last row`);
      await press(["Control+Home"]);
      assert.equal(await selectedId(), "1", `${label}: Ctrl+Home returns to the first row`);
      const stillFocused = await page.evaluate(() => {
        const active = document.activeElement;
        return active === window.grids.selectable.list || Boolean(active?.closest?.(".vlist-table-cell"));
      });
      assert.equal(stillFocused, true, `${label}: virtualized scrolling keeps focus in the grid`);

      // (3) Sort by Enter on a header, aria-sort through the cycle
      const firstHeader = page.locator("div.mtrl-data-grid").nth(1).locator(".vlist-table-header [role='columnheader']").nth(1);
      await firstHeader.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(80);
      assert.equal(await firstHeader.getAttribute("aria-sort"), "ascending", `${label}: Enter sorts ascending`);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(80);
      assert.equal(await firstHeader.getAttribute("aria-sort"), "descending", `${label}: Enter sorts descending`);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(80);
      assert.equal(await firstHeader.getAttribute("aria-sort"), null, `${label}: a third Enter clears the sort`);

      // (4) Alignment: an end-aligned column paints at the reading end, so
      //     its text sits hard against the physical left in RTL and the
      //     physical right in LTR
      await page.evaluate(() => {
        for (const viewport of window.grids.selectable.element.querySelectorAll(".vlist-viewport")) viewport.scrollTop = 0;
      });
      await page.waitForFunction(
        () =>
          [...window.grids.selectable.element.querySelectorAll(".vlist-table-row .vlist-table-cell")].some(
            (cell) => (cell.textContent ?? "").length > 0,
          ),
        {},
        { timeout: 5000 },
      );
      const alignment = await page.evaluate(() => {
        const row = window.grids.selectable.element.querySelector(".vlist-table-row");
        const cells = [...(row?.querySelectorAll(".vlist-table-cell") ?? [])];
        const score = cells[cells.length - 1];
        if (!score) return null;
        const range = document.createRange();
        range.selectNodeContents(score);
        const text = range.getBoundingClientRect();
        const box = score.getBoundingClientRect();
        return { leftGap: Math.round(text.left - box.left), rightGap: Math.round(box.right - text.right) };
      });
      assert.ok(alignment, `${label}: the score cell renders`);
      if (direction === "rtl") assert.ok(alignment.leftGap < alignment.rightGap, `${label}: an end-aligned column sits at the reading end (physical left)`);
      else assert.ok(alignment.rightGap < alignment.leftGap, `${label}: an end-aligned column sits at the reading end (physical right)`);

      // (4b) Horizontal cell focus: arrows step by column in the reading
      //      order, Home and End reach the row's ends, Ctrl+Home and Ctrl+End
      //      the grid's corners, and the active cell is the body's one tab stop
      const tabStops = await page.evaluate(() => {
        const selectable = window.grids.selectable.element;
        const cells = [...selectable.querySelectorAll(".vlist-table-cell")].filter((cell) => cell.tabIndex === 0);
        return { cells: cells.length, rootHasTabStop: selectable.querySelector(".vlist")?.hasAttribute("tabindex") };
      });
      assert.equal(tabStops.cells, 1, `${label}: the body holds one cell tab stop`);
      assert.equal(tabStops.rootHasTabStop, false, `${label}: the grid root is not a second tab stop`);
      assert.equal(await enterBody(), true, `${label}: Tab re-enters the active cell for the horizontal keys`);
      await page.waitForTimeout(60);
      const activeCell = () =>
        page.evaluate(() => {
          const cell = document.activeElement?.closest?.(".vlist-table-cell");
          if (!cell) return null;
          const row = cell.closest(".vlist-table-row");
          const cells = [...row.querySelectorAll(".vlist-table-cell")];
          return { row: Number(row.getAttribute("data-index")), column: cells.indexOf(cell), columns: cells.length };
        });
      await page.keyboard.press("End");
      await page.waitForTimeout(120);
      let active = await activeCell();
      assert.equal(active?.column, active.columns - 1, `${label}: End reaches the row's reading end`);
      await page.keyboard.press("Home");
      await page.waitForTimeout(120);
      active = await activeCell();
      assert.equal(active?.column, 0, `${label}: Home reaches the row's start`);
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(120);
      const afterRight = await activeCell();
      assert.equal(afterRight?.column, direction === "rtl" ? 0 : 1, `${label}: ArrowRight steps forward in the reading order`);
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(120);
      const afterLeft = await activeCell();
      assert.equal(afterLeft?.column, direction === "rtl" ? 1 : 0, `${label}: ArrowLeft steps back`);
      await page.keyboard.press("Control+End");
      await page.waitForTimeout(200);
      active = await activeCell();
      assert.equal(active?.row, 199, `${label}: Ctrl+End reaches the last row`);
      assert.equal(active?.column, active.columns - 1, `${label}: Ctrl+End reaches the last column`);
      await page.keyboard.press("Control+Home");
      await page.waitForTimeout(200);
      active = await activeCell();
      assert.equal(active?.row, 0, `${label}: Ctrl+Home reaches the first row`);
      assert.equal(active?.column, 0, `${label}: Ctrl+Home reaches the first column`);

      // (4c) With selection "none" the body still holds the active cell: Tab
      //      from the header enters it
      const plainEntry = await page.evaluate(async () => {
        const headers = [...window.grids.plain.element.querySelectorAll(".vlist-table-header [role='columnheader']")];
        headers[0]?.focus();
        return headers.length;
      });
      assert.ok(plainEntry > 0, `${label}: the display-only grid has a header`);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(150);
      const bodyEntry = await page.evaluate(() => {
        const cell = document.activeElement?.closest?.(".vlist-table-cell");
        const inPlain = Boolean(cell && window.grids.plain.element.contains(cell));
        const stops = [...window.grids.plain.element.querySelectorAll(".vlist-table-cell")].filter((node) => node.tabIndex === 0).length;
        return { inPlain, stops };
      });
      assert.equal(bodyEntry.inPlain, true, `${label}: Tab from the header enters the body with selection "none"`);
      assert.equal(bodyEntry.stops, 1, `${label}: the display-only body holds one tab stop`);

      // (4d) The active cell keeps a tab stop when its row is recycled out of
      //      the range, and takes focus back when the row returns
      for (const gridName of ["plain", "selectable"]) {
        const scrolled = await page.evaluate(async (name) => {
          const grid = window.grids[name];
          const content = () => grid.element.querySelector(".vlist-content");
          const viewport = grid.element.querySelector(".vlist-viewport");
          const stop = () => grid.element.querySelector(".vlist-table-cell[tabindex='0']");
          // Focus the active cell at the top
          const first = content().querySelector(".vlist-table-row .vlist-table-cell");
          first.focus();
          await new Promise((resolve) => setTimeout(resolve, 60));
          const before = grid.element.querySelectorAll(".vlist-table-cell[tabindex='0']").length;
          // Scroll far enough that the focused row recycles out
          viewport.scrollTop = 4000;
          await new Promise((resolve) => setTimeout(resolve, 250));
          const afterScroll = {
            stops: grid.element.querySelectorAll(".vlist-table-cell[tabindex='0']").length,
            focusInGrid: Boolean(content().contains(document.activeElement)),
            activeIsProxy: Boolean(document.activeElement?.closest?.(".vlist-table-cell")),
          };
          // Back to the top: the active cell returns and takes focus again
          viewport.scrollTop = 0;
          await new Promise((resolve) => setTimeout(resolve, 250));
          const activeRow = document.activeElement?.closest?.(".vlist-table-row");
          const afterReturn = {
            stops: grid.element.querySelectorAll(".vlist-table-cell[tabindex='0']").length,
            focusedRow: activeRow?.getAttribute("data-index") ?? null,
            focusedIsCell: Boolean(document.activeElement?.closest?.(".vlist-table-cell")),
          };
          void stop;
          return { before, afterScroll, afterReturn };
        }, gridName);
        assert.equal(scrolled.before, 1, `${label}/${gridName}: one tab stop before the scroll`);
        assert.equal(scrolled.afterScroll.stops, 1, `${label}/${gridName}: the tab stop stays while the active row is recycled`);
        assert.equal(scrolled.afterScroll.focusInGrid, true, `${label}/${gridName}: focus stays in the grid through the recycle`);
        assert.equal(scrolled.afterScroll.activeIsProxy, true, `${label}/${gridName}: the proxy cell holds the focus`);
        assert.equal(scrolled.afterReturn.stops, 1, `${label}/${gridName}: one tab stop after the return`);
        assert.equal(scrolled.afterReturn.focusedIsCell, true, `${label}/${gridName}: the active cell takes the focus back`);
        assert.equal(scrolled.afterReturn.focusedRow, "0", `${label}/${gridName}: focus returns to the active row`);
      }

      // (5) Selection: Space toggles the focused row, the header checkbox
      //     selects every loaded row
      // Space on the grid root selects the focused row
      assert.equal(await enterBody(), true, `${label}: Tab re-enters the grid's active cell`);
      await page.waitForTimeout(60);
      await page.keyboard.press("Space");
      await page.waitForTimeout(90);
      const spaceState = await page.evaluate(() => {
        const grid = window.grids.selectable;
        const selectedRow = grid.element.querySelector("[aria-selected='true']");
        return { values: grid.getValues(), selected: !!selectedRow, rowId: selectedRow?.getAttribute("data-id") };
      });
      assert.deepEqual(spaceState.values, [spaceState.rowId], `${label}: Space selects the focused row`);
      assert.equal(spaceState.selected, true, `${label}: the row carries aria-selected`);
      assert.equal(spaceState.selected, true, `${label}: the row carries aria-selected`);
      await page.evaluate(() => window.grids.selectable.setValues([]));
      const headerBox = page.locator("div.mtrl-data-grid").nth(1).locator(".vlist-table-header m-checkbox").first();
      await headerBox.click();
      await page.waitForTimeout(100);
      const afterAll = await page.evaluate(() => window.grids.selectable.getValues().length);
      assert.equal(afterAll, 200, `${label}: the header checkbox selects every row`);
      const headerChecked = await page.evaluate(() => window.grids.selectable.element.querySelector(".vlist-table-header m-checkbox")?.hasAttribute("checked"));
      assert.equal(headerChecked, true, `${label}: the header checkbox reflects the rows`);
      await headerBox.click();
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => window.grids.selectable.getValues().length), 0, `${label}: a second click clears`);
    }
  }

  assert.deepEqual(errors, [], "page errors");
  console.log("Data grid passes the AX roles, the roving body cell with its horizontal keys and corners, the header keyboard and sorting, selection and its header checkbox, the display-only body entry, and focus through virtualization in light and dark, left to right and right to left.");
} finally {
  await browser?.close();
  await server.close();
}
