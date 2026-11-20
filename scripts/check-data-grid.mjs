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
      // Tab order: the button, the display-only grid's first header cell, then
      // the selectable grid's root
      await page.locator("button").first().focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.waitForTimeout(80);
      const focusedOnGrid = await page.evaluate(() => document.activeElement === window.grids.selectable.list);
      assert.equal(focusedOnGrid, true, `${label}: Tab enters the grid`);
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
      // Focus entering the grid lands on the first row; the arrows step from
      // there
      assert.equal(await selectedId(), "1", `${label}: the grid focuses the first row`);
      await press(["ArrowDown"]);
      assert.equal(await selectedId(), "2", `${label}: ArrowDown moves`);
      await press(["ArrowUp"]);
      assert.equal(await selectedId(), "1", `${label}: ArrowUp moves`);
      await press(["End"]);
      const endId = await selectedId();
      assert.ok(endId && Number(endId) > 100, `${label}: End moves past one viewport (${endId})`);
      await press(["Home"]);
      assert.equal(await selectedId(), "1", `${label}: Home returns to the first row`);
      await press(["PageDown"]);
      const pageDownId = await selectedId();
      assert.ok(pageDownId && Number(pageDownId) > 1, `${label}: PageDown moves a viewport (${pageDownId})`);
      await press(["PageUp"]);
      assert.equal(await selectedId(), "1", `${label}: PageUp returns`);
      const stillFocused = await page.evaluate(() => {
        const active = document.activeElement;
        return active === window.grids.selectable.list || window.grids.selectable.list.contains(active);
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

      // (5) Selection: Space toggles the focused row, the header checkbox
      //     selects every loaded row
      // Space on the grid root selects the focused row
      await page.locator("button").first().focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.waitForTimeout(80);
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(90);
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
  console.log("Data grid passes the AX roles, body and header keyboard, header sorting, selection and focus through virtualization in light and dark, left to right and right to left.");
} finally {
  await browser?.close();
  await server.close();
}
