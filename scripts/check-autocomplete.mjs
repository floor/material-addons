import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0, hmr: false } });
let browser;
try {
  await server.listen();
  const { port } = server.httpServer.address();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 740, height: 520 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const reset = async () => {
    await page.goto(`http://127.0.0.1:${port}/test/browser/autocomplete.html`);
    await page.waitForFunction(() => !!window.autocomplete);
  };
  const mount = (mode, direction, variant, forced = false) => page.evaluate(({ mode, direction, variant, forced }) => {
    document.documentElement.dataset.themeMode = mode;
    document.documentElement.dir = direction;
    const crop = document.createElement("div");
    crop.style.cssText = "position:fixed;inset-block-start:40px;inset-inline-start:40px;width:320px;height:65px;overflow:hidden";
    const config = {
      variant, value: forced ? "sf" : null, label: "City", supportingText: "Choose a city", strict: true,
      filter: forced ? false : undefined,
      options: [
        { value: "sf", text: "San Francisco" },
        { value: "sd", text: "San Diego", supportingText: "California" },
        { value: "sl", text: "San Luis", disabled: true },
      ],
    };
    const component = window.autocomplete.createAutocomplete(config);
    crop.append(component.element);
    document.body.append(crop);
    window.component = component;
  }, { mode, direction, variant, forced });

  for (const mode of ["light", "dark"]) {
    for (const direction of ["ltr", "rtl"]) {
      await reset();
      const variant = direction === "ltr" ? "filled" : "outlined";
      await mount(mode, direction, variant);
      const input = page.getByRole("combobox");
      await input.focus();
      await input.pressSequentially("San ");
      const boxes = await page.evaluate(() => {
        const { listbox, textField } = window.component;
        const popup = listbox.getBoundingClientRect();
        const anchor = textField.field.getBoundingClientRect();
        const mark = listbox.querySelector("mark");
        const luminance = rgb => {
          const srgb = rgb.match(/[\d.]+/g).slice(0, 3).map(v => Number(v) / 255);
          const linear = srgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
          return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
        };
        const foreground = luminance(getComputedStyle(mark).color);
        const background = luminance(getComputedStyle(listbox).backgroundColor);
        const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        const trailing = textField.trailingIcon.getBoundingClientRect();
        return {
          edge: listbox.dir === "rtl" ? popup.right - anchor.right : popup.left - anchor.left,
          gap: popup.top - anchor.bottom,
          open: listbox.matches(":popover-open"),
          hit: listbox.contains(document.elementFromPoint(popup.left + 8, popup.bottom - 10)),
          contrast,
          variant: textField.getVariant(),
          clear: textField.trailingIcon.getAttribute("aria-label"),
          trailingSide: (trailing.left + trailing.width / 2 > anchor.left + anchor.width / 2) === (listbox.dir === "ltr"),
        };
      });
      assert.ok(Math.abs(boxes.edge) < 1 && Math.abs(boxes.gap) < 1, JSON.stringify(boxes));
      assert.ok(boxes.open && boxes.hit, "the popup must escape its clipped parent");
      assert.ok(boxes.contrast >= 4.5, `${mode}/${direction} match contrast ${boxes.contrast}`);
      assert.equal(boxes.variant, variant);
      assert.equal(boxes.clear, "Clear");
      assert.equal(boxes.trailingSide, true);
      assert.equal(await input.inputValue(), "San ");
      await input.press("Escape");
      const editableKeys = ["Home", "End", direction === "ltr" ? "ArrowLeft" : "ArrowRight"];
      const nativeCaret = [];
      for (const key of editableKeys) {
        await input.press(key);
        nativeCaret.push(await input.evaluate(el => el.selectionStart));
      }
      await input.evaluate(el => el.setSelectionRange(4, 4));
      await page.evaluate(() => window.component.open());
      await input.press("ArrowDown");
      assert.equal(await input.getAttribute("aria-activedescendant"), await page.getByRole("option", { name: /San Francisco/ }).getAttribute("id"));
      await input.press("ArrowDown");
      assert.equal(await input.getAttribute("aria-activedescendant"), await page.getByRole("option", { name: /San Diego/ }).getAttribute("id"));
      for (const [index, key] of editableKeys.entries()) {
        await input.press(key);
        assert.equal(await input.getAttribute("aria-activedescendant"), null);
        assert.equal(await input.evaluate(el => el.selectionStart), nativeCaret[index], `${mode}/${direction} ${key}`);
      }
      await input.press("ArrowDown");
      await input.press("Enter");
      assert.equal(await input.inputValue(), "San Francisco");
      assert.equal(await input.getAttribute("aria-expanded"), "false");
      assert.equal(await input.evaluate(el => document.activeElement === el), true);
      await page.getByRole("button", { name: "Clear" }).click();
      assert.equal(await input.inputValue(), "");
      // Use the actual top-layer hit point. Scrolling a locator into view
      // would scroll its clipped layout ancestor and dismiss the popup.
      const option = await page.getByRole("option", { name: /San Diego/ }).boundingBox();
      assert.ok(option?.width && option.height, `${mode}/${direction} pointer option has no box`);
      await page.mouse.click(option.x + option.width / 2, option.y + option.height / 2);
      assert.equal(await input.inputValue(), "San Diego");
      assert.equal(await input.evaluate(el => document.activeElement === el), true);
    }
  }

  await reset();
  await mount("light", "rtl", "outlined");
  const flipped = await page.evaluate(() => {
    const { element, listbox, textField } = window.component;
    element.parentElement.style.insetBlockStart = "450px";
    window.component.open();
    return listbox.getBoundingClientRect().bottom - textField.field.getBoundingClientRect().top;
  });
  assert.ok(Math.abs(flipped) < 1, "the popup flips above an anchor near the viewport bottom");

  await reset();
  await page.emulateMedia({ forcedColors: "active" });
  await mount("light", "ltr", "outlined", true);
  const colors = await page.evaluate(() => {
    const { listbox, textField } = window.component;
    const { input } = textField;
    input.focus();
    input.value = "San";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", cancelable: true, bubbles: true }));
    const active = document.getElementById(input.getAttribute("aria-activedescendant"));
    const selected = listbox.querySelector('[aria-selected="true"]');
    const probe = document.createElement("div");
    probe.style.cssText = "forced-color-adjust:none;background:Highlight;color:HighlightText";
    document.body.append(probe);
    return {
      active: getComputedStyle(active).outlineWidth,
      bg: getComputedStyle(selected).backgroundColor,
      fg: getComputedStyle(selected).color,
      expectedBg: getComputedStyle(probe).backgroundColor,
      expectedFg: getComputedStyle(probe).color,
      underline: getComputedStyle(active.querySelector("mark")).textDecorationLine,
    };
  });
  assert.equal(colors.active, "3px");
  assert.equal(colors.bg, colors.expectedBg);
  assert.equal(colors.fg, colors.expectedFg);
  assert.equal(colors.underline, "underline");

  await page.emulateMedia({ forcedColors: "none" });
  await reset();
  const preupgrade = await page.evaluate(() => {
    document.body.innerHTML = `<form><m-autocomplete name="city" value="sf" label="City" required strict>
      <m-autocomplete-option value="sf">San Francisco</m-autocomplete-option>
      <m-autocomplete-option value="sd">San Diego</m-autocomplete-option>
    </m-autocomplete><button type="submit">Submit</button></form>`;
    const host = document.querySelector("m-autocomplete");
    const option = document.querySelector("m-autocomplete-option");
    const result = { height: host.getBoundingClientRect().height, display: getComputedStyle(option).display };
    window.autocomplete.defineAutocomplete();
    return result;
  });
  assert.ok(preupgrade.height >= 56);
  assert.equal(preupgrade.display, "none");
  const field = page.getByRole("combobox");
  assert.equal(await field.inputValue(), "San Francisco");
  assert.equal(await page.locator("form").evaluate(form => new FormData(form).get("city")), "sf");
  await field.fill("San");
  const update = await page.evaluate(async () => {
    const host = document.querySelector("m-autocomplete");
    const original = host.component;
    const input = original.textField.input;
    input.setSelectionRange(1, 1);
    let redraws = 0;
    const setOptions = original.setOptions;
    original.setOptions = function (options) { redraws++; return setOptions.call(this, options); };
    const item = document.createElement("m-autocomplete-option");
    item.value = "sj";
    item.textContent = "San Jose";
    host.append(item);
    await Promise.resolve();
    return {
      redraws, same: host.component === original && host.shadowRoot.activeElement === input && input.selectionStart === 1,
      rendered: original.listbox.textContent.includes("San Jose") &&
        original.listbox.matches(":popover-open") && getComputedStyle(original.listbox).position === "fixed",
    };
  });
  assert.deepEqual(update, { redraws: 1, same: true, rendered: true });
  await page.getByRole("option", { name: "San Jose" }).click();
  assert.equal(await page.locator("form").evaluate(form => new FormData(form).get("city")), "sj");
  await page.locator("m-autocomplete").evaluate(host => { host.value = null; });
  assert.equal(await page.locator("form").evaluate(form => form.reportValidity()), false);
  await page.locator("form").evaluate(form => form.reset());
  assert.equal(await field.inputValue(), "San Francisco");
  assert.equal(await page.locator("form").evaluate(form => new FormData(form).get("city")), "sf");
  assert.deepEqual(errors, []);
  console.log("Autocomplete passes light/dark × LTR/RTL, keyboard and pointer, forced colors, pre-upgrade and form checks.");
} finally {
  await browser?.close();
  await server.close();
}
