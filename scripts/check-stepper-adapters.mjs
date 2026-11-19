import assert from "node:assert/strict";
import { chromium } from "playwright";
import { compile } from "svelte/compiler";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  resolve: { conditions: ["svelte", "module", "browser", "development"] },
  cacheDir: "node_modules/.vite-stepper-adapters",
  optimizeDeps: { entries: ["test/browser/stepper-adapters.html", "test/browser/autocomplete-adapters.html"], exclude: ["material-addons/svelte", "svelte"] },
  server: { host: "127.0.0.1", port: 0, hmr: false },
  plugins: [{
    name: "compile-svelte-fixture",
    transform(source, filename) {
      if (!filename.endsWith(".svelte")) return;
      return compile(source, { filename, generate: "client" }).js;
    },
  }],
});

let browser;
try {
  await server.listen();
  const { port } = server.httpServer.address();
  browser = await chromium.launch();
  for (const framework of ["react", "vue", "solid", "svelte"]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      await page.goto(`http://127.0.0.1:${port}/test/browser/stepper-adapters.html?framework=${framework}`);
      await page.waitForFunction(() => !!document.querySelector("m-stepper")?.component, { }, { timeout: 7_000 });
      const stepper = page.locator("m-stepper");
      assert.deepEqual(await stepper.evaluate(node => node.getSteps().map(step => [step.value, step.label, step.supportingText])), [
        ["one", "One", "First"], ["two", "Two", undefined],
      ], framework);
      assert.ok(await stepper.evaluate(node => node.shadowRoot.adoptedStyleSheets.length > 0), framework);
      assert.equal(await stepper.getAttribute("display"), "count", framework);
      assert.ok(await stepper.evaluate(node => node.component.element.classList.contains("mtrl-stepper--display-count")), framework);
      assert.equal(await stepper.evaluate(node => node.goTo("two")), false, framework);
      assert.equal(await stepper.evaluate(node => node.value), "one", framework);
      await page.evaluate(() => { window.veto = false; });
      assert.equal(await stepper.evaluate(node => node.goTo("two")), true, framework);
      await page.waitForFunction(() => document.querySelector("output")?.textContent === "two");
      assert.equal(await stepper.getAttribute("display"), "dots", framework);
      assert.ok(await stepper.evaluate(node => node.component.element.classList.contains("mtrl-stepper--display-dots")), framework);
      assert.deepEqual(await page.evaluate(() => window.events), [
        ["beforechange", "two", true], ["beforechange", "two", true], ["change", "two"],
      ], framework);
      assert.deepEqual(errors, [], framework);
      console.log(`${framework}: declarations, styles, cancellable events and model updates passed`);

      await page.goto(`http://127.0.0.1:${port}/test/browser/autocomplete-adapters.html?framework=${framework}`);
      await page.waitForFunction(() => !!document.querySelector("m-autocomplete")?.component, {}, { timeout: 7_000 });
      const autocomplete = page.locator("m-autocomplete");
      assert.ok(await autocomplete.evaluate(node => node.shadowRoot.adoptedStyleSheets.length > 0), framework);
      assert.equal(await autocomplete.getAttribute("no-open-on-focus"), "", framework);
      assert.deepEqual(await autocomplete.evaluate(node => node.getOptions().map(option => [option.value, option.text, option.supportingText])), [
        ["ch", "Switzerland", "Europe"], ["jp", "Japan", undefined],
      ], framework);
      const input = autocomplete.getByRole("combobox");
      await input.focus();
      assert.equal(await input.getAttribute("aria-expanded"), "false", framework);
      await input.fill("Swi");
      await autocomplete.getByRole("option", { name: /Switzerland/ }).click();
      await page.waitForFunction(() => document.querySelector("output")?.textContent === "ch");
      assert.equal(await autocomplete.evaluate(node => node.value), "ch", framework);
      assert.deepEqual(await page.evaluate(() => window.events), [["input", "Swi"], ["select", "ch"], ["change", "ch"]], framework);
      await page.getByRole("button", { name: "Set Japan" }).click();
      await page.waitForFunction(() => document.querySelector("m-autocomplete")?.value === "jp");
      assert.equal(await input.inputValue(), "Japan", framework);
      assert.deepEqual(errors, [], framework);
      console.log(`${framework}: autocomplete options, styles, typed event delivery and model updates passed`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
