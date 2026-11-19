// The stepper's browser behaviour that jsdom cannot prove: where focus lands
// after a panel action, with real visibility, inertness and native focus.
//
//   bun run build --production && node scripts/check-stepper.mjs
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0, hmr: false } });
let browser;
try {
  await server.listen();
  const { port } = server.httpServer.address();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const reset = async () => {
    await page.goto(`http://127.0.0.1:${port}/test/browser/stepper.html`);
    await page.waitForFunction(() => !!window.stepper);
  };

  // A destination whose first candidate cannot take focus
  const focusAfterAction = (config, content) => page.evaluate(async ({ config, content }) => {
    document.body.innerHTML = "";
    const stepper = window.stepper.createStepper({
      ...config,
      steps: [
        { value: "account", label: "Account details", content: `<button data-stepper-next>Next</button>` },
        { value: "address", label: "Shipping address", content },
      ],
    });
    document.body.append(stepper.element);
    stepper.element.querySelector("[data-stepper-next]").click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const active = document.activeElement;
    const panel = active === stepper.getPanelElement(1);
    return {
      value: stepper.getValue(),
      // The panel's own id is an implementation detail; the case is "the panel"
      id: panel ? null : active?.id ?? null,
      panel,
    };
  }, { config, content });

  await reset();
  const hiddenInput = await focusAfterAction({}, `<input type="hidden" id="hint"><input id="city">`);
  assert.deepEqual(hiddenInput, { value: "address", id: "city", panel: false });

  const hiddenAttr = await focusAfterAction({}, `<input hidden id="hint"><input id="city">`);
  assert.deepEqual(hiddenAttr, { value: "address", id: "city", panel: false });

  const styled = await focusAfterAction({}, `<input style="display:none" id="hint"><input id="city">`);
  assert.deepEqual(styled, { value: "address", id: "city", panel: false });

  const inert = await focusAfterAction({}, `<div inert><input id="hint"></div><input id="city">`);
  assert.deepEqual(inert, { value: "address", id: "city", panel: false });

  const disabled = await focusAfterAction({}, `<button disabled id="hint">Skip</button><input id="city">`);
  assert.deepEqual(disabled, { value: "address", id: "city", panel: false });

  const fieldset = await focusAfterAction({}, `<fieldset disabled><input id="hint"></fieldset><input id="city">`);
  assert.deepEqual(fieldset, { value: "address", id: "city", panel: false });

  const noTarget = await focusAfterAction({}, `<p>Nothing to focus</p>`);
  assert.deepEqual(noTarget, { value: "address", id: null, panel: true });

  const headingMode = await focusAfterAction({ focusOnAction: "heading" }, `<h2 hidden id="hint">Hidden</h2><h2 id="title">Visible</h2>`);
  assert.deepEqual(headingMode, { value: "address", id: "title", panel: false });

  const headingFallback = await focusAfterAction({ focusOnAction: "heading" }, `<p>No heading</p><input id="city">`);
  assert.deepEqual(headingFallback, { value: "address", id: null, panel: true });

  // Header navigation keeps focus on the header it was on
  await reset();
  const headerFocus = await page.evaluate(async () => {
    document.body.innerHTML = "";
    const stepper = window.stepper.createStepper({
      steps: [{ value: "a", label: "A", content: "one" }, { value: "b", label: "B", content: `<input id="field">` }],
    });
    document.body.append(stepper.element);
    const header = stepper.getHeaderElement(1);
    header.focus();
    header.click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    return { value: stepper.getValue(), onHeader: document.activeElement === stepper.getHeaderElement(1) };
  });
  assert.deepEqual(headerFocus, { value: "b", onHeader: true });

  // The element reports a failed validation as validationerror, never as error
  await reset();
  const events = await page.evaluate(async () => {
    document.body.innerHTML = `<div id="wrap"><m-stepper linear>
      <m-step value="a" label="A"><form><input required></form></m-step>
      <m-step value="b" label="B"></m-step></m-stepper></div>`;
    window.stepper.defineStepper();
    const host = document.querySelector("m-stepper");
    let hostSaw = 0;
    let ancestorSaw = 0;
    let nativeError = 0;
    host.addEventListener("validationerror", () => { hostSaw += 1; });
    document.getElementById("wrap").addEventListener("validationerror", () => { ancestorSaw += 1; });
    window.addEventListener("error", () => { nativeError += 1; }, true);
    await host.next();
    return { hostSaw, ancestorSaw, nativeError };
  });
  assert.deepEqual(events, { hostSaw: 1, ancestorSaw: 1, nativeError: 0 });

  // Slotted content: a form blocks the move, reset clears it, and the action
  // lands on a slotted control
  const slotted = await page.evaluate(async () => {
    document.body.innerHTML = `<m-stepper linear>
      <m-step value="account" label="Account"><form><input id="name" required></form><button type="button" data-stepper-next>Next</button></m-step>
      <m-step value="address" label="Address"><input id="city"></m-step></m-stepper>`;
    window.stepper.defineStepper();
    const host = document.querySelector("m-stepper");
    const input = host.querySelector("#name");
    const blocked = await host.next();
    input.value = "Ada";
    host.querySelector("[data-stepper-next]").click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const moved = host.value;
    const focused = document.activeElement === host.querySelector("#city");
    host.reset();
    return { blocked, moved, focused, value: host.value, field: input.value };
  });
  assert.deepEqual(slotted, { blocked: false, moved: "address", focused: true, value: "account", field: "" });

  assert.deepEqual(errors, []);
  console.log("Stepper passes browser focus eligibility, panel and heading fallbacks, header focus, validationerror and slotted content.");
} finally {
  await browser?.close();
  await server.close();
}
