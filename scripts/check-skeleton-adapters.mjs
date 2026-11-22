// The skeleton's framework adapters in Chromium: React with plain-prop
// spellings (the value props also accept their default- spellings), and the
// generated Svelte component, which defines the element on mount.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { compile } from "svelte/compiler";
import { createServer } from "vite";
import { MATERIAL_DEPS } from "./vite-deps.mjs";

const server = await createServer({
  configFile: false,
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  resolve: { conditions: ["svelte", "module", "browser", "development"] },
  cacheDir: "node_modules/.vite-skeleton-adapters",
  optimizeDeps: { include: MATERIAL_DEPS, entries: ["test/browser/_skeleton-adapters.html"], exclude: ["material-addons/svelte", "svelte"] },
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

  // React: plain spellings reach the placeholder.
  {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/test/browser/_skeleton-adapters.html`);
    await page.waitForFunction(() => !!window.skeletonAdapters);
    const out = await page.evaluate(async () => {
      const { React, createRoot, ReactSkeleton } = window.skeletonAdapters;
      createRoot(document.getElementById("react-root")).render(
        React.createElement(ReactSkeleton, { size: "large", lines: 3, motion: "pulse", noBusy: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 150));
      const host = document.querySelector("#react-root m-skeleton");
      const inner = host?.shadowRoot?.querySelector(".mtrl-skeleton");
      return { upgraded: !!inner, dataset: inner?.dataset, busy: inner?.hasAttribute("aria-busy") };
    });
    assert.equal(out.upgraded, true, "react: the element upgrades");
    assert.equal(out.dataset.size, "large", `react: size reaches the placeholder (got ${out.dataset.size})`);
    assert.equal(out.dataset.lines, "multi", "react: lines reaches the placeholder");
    assert.equal(out.dataset.motion, "pulse", "react: motion reaches the placeholder");
    assert.equal(out.busy, false, "react: noBusy opts out");
    assert.deepEqual(errors, [], "react: no page errors");
    await page.close();
    console.log("react: plain props size/lines/motion/noBusy reach the placeholder");
  }

  // Svelte: the generated component defines the element on mount.
  {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/test/browser/_skeleton-adapters.html`);
    await page.waitForFunction(() => !!window.skeletonAdapters);
    const out = await page.evaluate(async () => {
      const { svelteMount } = window.skeletonAdapters;
      const { default: Fixture } = await import("./SkeletonSvelteFixture.svelte");
      svelteMount(Fixture, { target: document.getElementById("svelte-root") });
      await new Promise((resolve) => setTimeout(resolve, 150));
      const host = document.querySelector("#svelte-root m-skeleton");
      const inner = host?.shadowRoot?.querySelector(".mtrl-skeleton");
      return { upgraded: !!inner, dataset: inner?.dataset };
    });
    assert.equal(out.upgraded, true, "svelte: the generated component upgrades the element");
    assert.equal(out.dataset.variant, "circle", "svelte: variant reaches the placeholder");
    assert.equal(out.dataset.size, "large", "svelte: size reaches the placeholder");
    assert.deepEqual(errors, [], "svelte: no page errors");
    await page.close();
    console.log("svelte: the generated component upgrades and forwards attributes");
  }

  console.log("Passed skeleton adapter checks.");
} finally {
  await browser?.close();
  await server.close();
}
