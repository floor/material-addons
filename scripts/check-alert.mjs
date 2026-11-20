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
  cacheDir: "node_modules/.vite-alert",
  optimizeDeps: { entries: ["test/browser/alert.html"], exclude: ["material-addons/svelte", "svelte"] },
  server: { host: "127.0.0.1", port: 0, hmr: false },
  plugins: [{
    name: "compile-svelte-fixture",
    transform(source, filename) {
      if (filename.endsWith(".svelte")) return compile(source, { filename, generate: "client" }).js;
    },
  }],
});

let browser;
const watchdog = setTimeout(() => {
  console.error("check-alert.mjs: hard 30s timeout exceeded");
  browser?.close().finally(() => process.exit(1));
}, 30_000);
watchdog.unref();
try {
  await server.listen();
  const { port } = server.httpServer.address();
  const fixture = `http://127.0.0.1:${port}/test/browser/alert.html`;
  browser = await chromium.launch();

  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(fixture);
  await page.locator("#alert-info-tonal").waitFor();

  // Verify ARIA role mapping by severity
  assert.equal(await page.locator("#alert-info-tonal").getAttribute("role"), "status");
  assert.equal(await page.locator("#alert-success-tonal").getAttribute("role"), "status");
  assert.equal(await page.locator("#alert-warning-tonal").getAttribute("role"), "alert");
  assert.equal(await page.locator("#alert-error-tonal").getAttribute("role"), "alert");

  // Verify 48x48 touch targets on action and dismiss buttons
  const actionBox = await page.locator("#alert-info-tonal .mtrl-alert__action").boundingBox();
  const dismissBox = await page.locator("#alert-info-tonal .mtrl-alert__dismiss").boundingBox();
  assert.equal(actionBox.width >= 48 && actionBox.height >= 48, true, "action button has >= 48x48 target");
  assert.equal(dismissBox.width >= 48 && dismissBox.height >= 48, true, "dismiss button has >= 48x48 target");

  // Verify Light / Dark x LTR / RTL geometry & distinct severity/variant colors
  for (const [mode, surface, onSurface, secondaryContainer, onSecondaryContainer, errorContainer, onErrorContainer] of [
    ["light", "rgb(254, 247, 255)", "rgb(29, 27, 32)", "rgb(232, 222, 248)", "rgb(29, 25, 43)", "rgb(249, 222, 220)", "rgb(65, 14, 11)"],
    ["dark", "rgb(20, 18, 24)", "rgb(230, 224, 233)", "rgb(74, 68, 88)", "rgb(232, 222, 248)", "rgb(140, 29, 24)", "rgb(249, 222, 220)"],
  ]) {
    await page.evaluate(([, s, os, sc, osc, ec, oec]) => {
      document.documentElement.style.setProperty("--mtrl-sys-color-surface", s);
      document.documentElement.style.setProperty("--mtrl-sys-color-on-surface", os);
      document.documentElement.style.setProperty("--mtrl-sys-color-secondary-container", sc);
      document.documentElement.style.setProperty("--mtrl-sys-color-on-secondary-container", osc);
      document.documentElement.style.setProperty("--mtrl-sys-color-error-container", ec);
      document.documentElement.style.setProperty("--mtrl-sys-color-on-error-container", oec);
    }, [mode, surface, onSurface, secondaryContainer, onSecondaryContainer, errorContainer, onErrorContainer]);

    const tonalColors = await page.evaluate(() => {
      const bg = id => getComputedStyle(document.getElementById(id)).backgroundColor;
      return [bg("alert-info-tonal"), bg("alert-success-tonal"), bg("alert-warning-tonal"), bg("alert-error-tonal")];
    });
    assert.equal(new Set(tonalColors).size, 4, `${mode}: all 4 severities resolve distinct tonal backgrounds`);

    for (const dir of ["ltr", "rtl"]) {
      await page.evaluate(d => { document.documentElement.dir = d; }, dir);
      const iconRect = await page.locator("#alert-info-tonal .mtrl-alert__icon").boundingBox();
      const contentRect = await page.locator("#alert-info-tonal .mtrl-alert__content").boundingBox();
      const actRect = await page.locator("#alert-info-tonal .mtrl-alert__action").boundingBox();
      const disRect = await page.locator("#alert-info-tonal .mtrl-alert__dismiss").boundingBox();
      if (dir === "ltr") {
        assert.equal(iconRect.x < contentRect.x && contentRect.x < actRect.x && actRect.x < disRect.x, true, `${mode}/ltr order`);
      } else {
        assert.equal(iconRect.x > contentRect.x && contentRect.x > actRect.x && actRect.x > disRect.x, true, `${mode}/rtl order`);
      }
    }
  }

  // Reduced motion
  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await page.locator("#alert-info-tonal").evaluate(node => getComputedStyle(node).transitionDuration);
  assert.equal(duration, "0s", "prefers-reduced-motion disables alert transition");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // Forced colors
  await page.emulateMedia({ forcedColors: "active" });
  const reference = page.locator("#forced-reference");
  const errAlert = page.locator("#alert-error-outlined");
  assert.equal(await errAlert.evaluate(n => getComputedStyle(n).borderTopWidth), "2px");
  assert.equal(
    await errAlert.evaluate(n => getComputedStyle(n).borderTopColor),
    await reference.evaluate(n => getComputedStyle(n).borderTopColor),
  );
  const dismissBtn = errAlert.locator(".mtrl-alert__dismiss");
  await dismissBtn.focus();
  await page.keyboard.press("Tab");
  const nextAction = page.locator("#alert-error-filled .mtrl-alert__action");
  assert.equal(await nextAction.evaluate(n => n.matches(":focus-visible")), true);
  assert.equal(
    await nextAction.evaluate(n => getComputedStyle(n).outlineColor),
    await reference.evaluate(n => getComputedStyle(n).outlineColor),
  );
  assert.deepEqual(errors, []);
  await page.close();
  console.log("Alert severities, variants, light/dark x LTR/RTL, reduced motion, and forced colors passed");

  // Framework adapters (React, Vue, Solid, Svelte 5)
  for (const framework of ["react", "vue", "solid", "svelte"]) {
    const page = await browser.newPage();
    page.setDefaultTimeout(10_000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${fixture}?framework=${framework}`);
    const alertRoot = page.getByRole("alert");
    await alertRoot.waitFor();
    assert.equal(await alertRoot.getByText("Quota warning").count(), 1, framework);
    assert.equal(await alertRoot.getByText("90% of storage used").count(), 1, framework);

    const actionButton = alertRoot.getByRole("button", { name: "Upgrade" });
    await actionButton.focus();
    await page.keyboard.press("Enter");
    assert.deepEqual(await page.evaluate(() => window.alertEvents), [["action", "warning"]], framework);

    const dismissButton = alertRoot.getByRole("button", { name: "Dismiss" });
    await page.keyboard.press("Tab");
    assert.equal(await dismissButton.evaluate(n => n.matches(":focus-visible")), true, framework);
    await page.keyboard.press("Space");
    // Vetoed on first press
    assert.equal(await alertRoot.isVisible(), true, `${framework}: vetoed dismiss keeps alert visible`);
    assert.deepEqual(
      await page.evaluate(() => window.alertEvents),
      [["action", "warning"], ["beforedismiss", "warning", "button"]],
      framework,
    );

    // Allow dismiss on second press
    await page.evaluate(() => { window.vetoAlertDismiss = false; });
    await page.keyboard.press("Enter");
    assert.equal(await alertRoot.isVisible(), false, `${framework}: unvetoed dismiss hides alert`);
    assert.deepEqual(
      await page.evaluate(() => window.alertEvents),
      [
        ["action", "warning"],
        ["beforedismiss", "warning", "button"],
        ["beforedismiss", "warning", "button"],
        ["dismiss", "warning", "button"],
      ],
      framework,
    );
    assert.deepEqual(errors, [], framework);
    await page.close();
    console.log(`${framework}: alert attributes, keyboard activation, and vetoable dismiss passed`);
  }
} finally {
  clearTimeout(watchdog);
  await browser?.close();
  await server.close();
}
