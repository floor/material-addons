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
  optimizeDeps: { entries: ["test/browser/stepper-adapters.html"], exclude: ["material-addons/svelte", "svelte"] },
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
      assert.equal(await stepper.evaluate(node => node.goTo("two")), false, framework);
      assert.equal(await stepper.evaluate(node => node.value), "one", framework);
      await page.evaluate(() => { window.veto = false; });
      assert.equal(await stepper.evaluate(node => node.goTo("two")), true, framework);
      await page.waitForFunction(() => document.querySelector("output")?.textContent === "two");
      assert.deepEqual(await page.evaluate(() => window.events), [
        ["beforechange", "two", true], ["beforechange", "two", true], ["change", "two"],
      ], framework);
      assert.deepEqual(errors, [], framework);
      console.log(`${framework}: declarations, styles, cancellable events and model updates passed`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
