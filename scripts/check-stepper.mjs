// The stepper's browser behaviour that jsdom cannot prove: where focus lands
// after a panel action, with real visibility, inertness and native focus.
//
//   bun run build --production && node scripts/check-stepper.mjs
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  optimizeDeps: { entries: ["test/browser/stepper.html"] },
  server: { host: "127.0.0.1", port: 0, hmr: false },
});
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

  // Compact displays: the count and progress lines are visible and the list is
  // not; dots keep the headers interactive with the labels clipped
  await reset();
  const compact = await page.evaluate(async () => {
    const mount = (display) => {
      const stepper = window.stepper.createStepper({
        display,
        steps: [
          { value: "a", label: "First", content: "one" },
          { value: "b", label: "Second", content: `<input id="second">` },
        ],
      });
      document.body.append(stepper.element);
      return stepper;
    };
    const countStepper = mount("count");
    const count = countStepper.element.querySelector(".mtrl-stepper__count");
    const countList = countStepper.element.querySelector(".mtrl-stepper__list");
    const countValues = {
      countText: count.textContent,
      countVisible: count.getBoundingClientRect().height > 0,
      listHidden: getComputedStyle(countList).display === "none",
    };
    countStepper.element.remove();

    const progressStepper = mount("progress");
    const progress = progressStepper.element.querySelector('[role="progressbar"]');
    const fill = progress.querySelector(".mtrl-stepper__progress-bar > span");
    const progressValues = {
      now: progress.getAttribute("aria-valuenow"),
      max: progress.getAttribute("aria-valuemax"),
      label: progress.querySelector(".mtrl-stepper__progress-label").textContent,
      fill: fill.getBoundingClientRect().width,
      listHidden: getComputedStyle(progressStepper.element.querySelector(".mtrl-stepper__list")).display === "none",
      visible: progress.getBoundingClientRect().height > 0,
    };
    progressStepper.element.remove();

    const dotsStepper = mount("dots");
    const list = dotsStepper.element.querySelector(".mtrl-stepper__list");
    const group = dotsStepper.element.querySelector(".mtrl-stepper__label-group");
    const dots = {
      listVisible: list.getBoundingClientRect().height > 0,
      groupWidth: group.getBoundingClientRect().width,
      activeDot: dotsStepper.element.querySelector(".mtrl-stepper__item--active .mtrl-stepper__indicator").getBoundingClientRect().width,
      dot: dotsStepper.element.querySelector(".mtrl-stepper__item:not(.mtrl-stepper__item--active) .mtrl-stepper__indicator").getBoundingClientRect().width,
    };
    dotsStepper.getHeaderElement(1).click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const dotsMoved = dotsStepper.getValue();
    dotsStepper.element.remove();
    return { ...countValues, progressValues, dots, dotsMoved };
  });
  assert.equal(compact.countText, "Step 1 of 2: First");
  assert.equal(compact.countVisible, true);
  assert.equal(compact.listHidden, true);
  assert.equal(compact.progressValues.now, "1");
  assert.equal(compact.progressValues.max, "2");
  assert.equal(compact.progressValues.label, "Step 1 of 2: First");
  assert.ok(compact.progressValues.fill > 0 && compact.progressValues.visible, JSON.stringify(compact.progressValues));
  assert.equal(compact.progressValues.listHidden, true);
  assert.equal(compact.dots.listVisible, true);
  assert.ok(compact.dots.groupWidth <= 1, `label group clipped: ${compact.dots.groupWidth}`);
  assert.ok(compact.dots.activeDot > compact.dots.dot, `active dot wider: ${JSON.stringify(compact.dots)}`);
  assert.equal(compact.dotsMoved, "b");

  // A bottom label under a vertical stepper: the label reads as the end
  // layout, so the circle, connector and label keep one axis
  await reset();
  const verticalBottom = await page.evaluate(async () => {
    document.body.replaceChildren();
    const stepper = window.stepper.createStepper({
      orientation: "vertical",
      labelPlacement: "bottom",
      steps: [
        { value: "store", label: "Store", content: "Choose a shop." },
        { value: "time", label: "Pickup time", content: "Choose a time." },
        { value: "review", label: "Review", content: "Review the order." },
      ],
    });
    stepper.element.style.width = "480px";
    document.body.append(stepper.element);
    await new Promise((resolve) => setTimeout(resolve, 60));
    const root = stepper.element;
    const items = [...root.querySelectorAll(".mtrl-stepper__item")];
    const rows = items.map((item) => {
      const header = item.querySelector(".mtrl-stepper__header");
      const indicator = item.querySelector(".mtrl-stepper__indicator");
      const label = item.querySelector(".mtrl-stepper__label");
      const connector = item.querySelector(".mtrl-stepper__connector");
      const box = (node) => (node ? node.getBoundingClientRect() : null);
      const circle = box(indicator);
      const words = box(label);
      const line = box(connector);
      return {
        centered: circle ? Math.round(circle.left + circle.width / 2) : null,
        line: line ? Math.round(line.left + line.width / 2) : null,
        labelBeside: Boolean(circle && words && words.left >= circle.right - 1),
        headerRows: header ? Math.round(box(label).top - circle.top) : null,
      };
    });
    return {
      bottomClass: root.classList.contains("mtrl-stepper--label-bottom"),
      endClass: root.classList.contains("mtrl-stepper--label-end"),
      rows,
    };
  });
  assert.equal(verticalBottom.bottomClass, false, "a vertical stepper drops the bottom label class");
  assert.equal(verticalBottom.endClass, true, "a vertical stepper takes the end label class");
  for (const [index, row] of verticalBottom.rows.entries()) {
    // The last item draws no connector, so there is no rail to line up there
    if (row.line > 0) assert.ok(Math.abs(row.line - row.centered) <= 1, `vertical bottom: circle and connector share a centre on step ${index + 1}: ${JSON.stringify(row)}`);
    assert.equal(row.labelBeside, true, `vertical bottom: the label sits beside the circle on step ${index + 1}`);
  }

  // A narrow horizontal stepper truncates its labels inside their headers, in
  // both placements, and never shrinks one to an unreadable box
  const narrow = async (placement, width) => {
    await reset();
    return page.evaluate(async ({ labelPlacement, width }) => {
      document.body.replaceChildren();
      const stepper = window.stepper.createStepper({
        orientation: "horizontal",
        ...(labelPlacement ? { labelPlacement } : {}),
        steps: [
          { value: "store", label: "Store", content: "Choose a shop.", supportingText: "Open now" },
          { value: "time", label: "Pickup time and address", content: "Choose a time.", supportingText: "Today, 4 pm" },
          { value: "review", label: "Review the order", content: "Review the order.", supportingText: "One more step" },
        ],
      });
      stepper.element.style.width = `${width}px`;
      document.body.append(stepper.element);
      await new Promise((resolve) => setTimeout(resolve, 60));
      return [...stepper.element.querySelectorAll(".mtrl-stepper__header")].map((header) => {
        const measure = (node) => {
          if (!node) return null;
          const style = getComputedStyle(node);
          const box = node.getBoundingClientRect();
          const frame = header.getBoundingClientRect();
          return {
            width: Math.round(box.width),
            inside: Math.round(box.left) >= Math.round(frame.left) - 1 && Math.round(box.right) <= Math.round(frame.right) + 1,
            overflow: style.textOverflow,
            nowrap: style.whiteSpace,
            truncated: node.scrollWidth > node.clientWidth,
          };
        };
        return { label: measure(header.querySelector(".mtrl-stepper__label")), supporting: measure(header.querySelector(".mtrl-stepper__supporting-text")) };
      });
    }, { labelPlacement: placement, width });
  };
  for (const width of [312, 480]) {
  for (const placement of ["bottom", null]) {
    const rows = await narrow(placement, width);
    const name = `${width}px ${placement ? `${placement} placement` : "end placement"}`;
    for (const [index, row] of rows.entries()) {
      assert.ok(row.label.width >= 24, `horizontal ${name}: label ${index + 1} keeps a readable box (${row.label.width}px)`);
      assert.equal(row.label.inside, true, `horizontal ${name}: label ${index + 1} stays inside its header`);
      assert.equal(row.label.overflow, "ellipsis", `horizontal ${name}: label ${index + 1} ends in an ellipsis`);
      assert.equal(row.label.nowrap, "nowrap", `horizontal ${name}: label ${index + 1} stays on one line`);
      if (row.supporting) {
        assert.equal(row.supporting.inside, true, `horizontal ${name}: supporting text ${index + 1} stays inside its header`);
        assert.ok(row.supporting.width > 0, `horizontal ${name}: supporting text ${index + 1} keeps a box`);
      }
    }
    assert.ok(rows.some((row) => row.label.truncated), `horizontal ${name}: a long label truncates`);
  }
  }

  // The label floor is per step, not per stepper: four steps at the old cutoff
  // and five in a 480px row keep every label inside its header, on both sides
  // of any width where a whole-stepper rule would have switched behaviour
  for (const [count, width] of [[4, 312], [4, 384], [4, 385], [5, 480]]) {
    await reset();
    const rows = await page.evaluate(async ({ count, width }) => {
      document.body.replaceChildren();
      const steps = ["Store", "Pickup time and address", "Review the order", "Confirm and pay", "Done"].slice(0, count).map((label, index) => ({
        value: `step-${index}`, label, content: `Panel ${index}`,
      }));
      const stepper = window.stepper.createStepper({ orientation: "horizontal", steps });
      stepper.element.style.width = `${width}px`;
      document.body.append(stepper.element);
      await new Promise((resolve) => setTimeout(resolve, 60));
      return [...stepper.element.querySelectorAll(".mtrl-stepper__header")].map((header) => {
        const label = header.querySelector(".mtrl-stepper__label");
        const box = label.getBoundingClientRect();
        const frame = header.getBoundingClientRect();
        return {
          width: Math.round(box.width),
          inside: Math.round(box.left) >= Math.round(frame.left) - 1 && Math.round(box.right) <= Math.round(frame.right) + 1,
          ellipsis: getComputedStyle(label).textOverflow === "ellipsis" && getComputedStyle(label).whiteSpace === "nowrap",
        };
      });
    }, { count, width });
    for (const [index, row] of rows.entries()) {
      assert.equal(row.inside, true, `${count} steps at ${width}px: label ${index + 1} stays inside its header`);
      assert.equal(row.ellipsis, true, `${count} steps at ${width}px: label ${index + 1} ends in an ellipsis`);
    }
    const readable = rows.filter((row) => row.width >= 24).length;
    assert.ok(readable >= 1, `${count} steps at ${width}px: at least one label keeps a readable box`);
  }

  // A shrink-to-fit stepper keeps its intrinsic width: nothing on the root
  // turns the element into its own size container
  await reset();
  const intrinsic = await page.evaluate(async () => {
    document.body.replaceChildren();
    const wrap = document.createElement("div");
    wrap.style.cssText = "display: flex; width: 880px";
    document.body.append(wrap);
    const stepper = window.stepper.createStepper({
      orientation: "horizontal",
      steps: [
        { value: "store", label: "Store", content: "Choose a shop." },
        { value: "time", label: "Pickup time and address", content: "Choose a time." },
        { value: "review", label: "Review the order", content: "Review the order." },
      ],
    });
    stepper.element.style.width = "fit-content";
    wrap.append(stepper.element);
    await new Promise((resolve) => setTimeout(resolve, 60));
    const root = stepper.element.getBoundingClientRect();
    return { width: Math.round(root.width), overflow: stepper.element.scrollWidth > stepper.element.clientWidth + 1 };
  });
  assert.ok(intrinsic.width > 300, `shrink-to-fit: the stepper keeps an intrinsic width (${intrinsic.width}px)`);
  assert.equal(intrinsic.overflow, false, "shrink-to-fit: nothing overflows the stepper");

  // The same row at a wide width keeps the connector rail and untruncated names
  await reset();
  const wide = await page.evaluate(async () => {
    document.body.replaceChildren();
    const stepper = window.stepper.createStepper({
      orientation: "horizontal",
      steps: [
        { value: "store", label: "Store", content: "Choose a shop." },
        { value: "time", label: "Pickup time and address", content: "Choose a time." },
        { value: "review", label: "Review the order", content: "Review the order." },
      ],
    });
    stepper.element.style.width = "880px";
    document.body.append(stepper.element);
    await new Promise((resolve) => setTimeout(resolve, 60));
    const connectors = [...stepper.element.querySelectorAll(".mtrl-stepper__connector")].filter((node) => node.getBoundingClientRect().width > 0);
    const labels = [...stepper.element.querySelectorAll(".mtrl-stepper__label")];
    return {
      connector: Math.round(connectors[0]?.getBoundingClientRect().width ?? 0),
      truncated: labels.some((node) => node.scrollWidth > node.clientWidth),
    };
  });
  assert.ok(wide.connector >= 32, `horizontal 880px: the connector keeps its rail (${wide.connector}px)`);
  assert.equal(wide.truncated, false, "horizontal 880px: no label truncates");

  // Vertical compact modes: the active panel and its action stay visible, and
  // the hidden list is not a tab stop
  await reset();
  const vertical = await page.evaluate(async () => {
    const results = [];
    for (const display of ["count", "progress"]) {
      document.body.innerHTML = "";
      const stepper = window.stepper.createStepper({
        orientation: "vertical",
        display,
        steps: [
          { value: "a", label: "First", content: `<button type="button" data-stepper-next>Next</button>` },
          { value: "b", label: "Second", content: `<input id="second">` },
        ],
      });
      document.body.append(stepper.element);
      const list = stepper.element.querySelector(".mtrl-stepper__list");
      const panel = stepper.getPanelElement(0);
      const button = stepper.element.querySelector("[data-stepper-next]");
      results.push({
        display,
        listHidden: list.hidden,
        panelVisible: panel.getBoundingClientRect().height > 0,
        buttonVisible: button.getBoundingClientRect().height > 0,
        headerTabStop: stepper.getHeaderElement(0).closest("[hidden]") === null,
      });
      stepper.element.remove();
    }
    return results;
  });
  for (const row of vertical) {
    assert.equal(row.listHidden, true, `vertical ${row.display} list hidden`);
    assert.equal(row.panelVisible, true, `vertical ${row.display} panel visible`);
    assert.equal(row.buttonVisible, true, `vertical ${row.display} button visible`);
    assert.equal(row.headerTabStop, false, `vertical ${row.display} header not a tab stop`);
  }

  // The compact status is exposed and kept current; a display change does not
  // touch the step state
  await reset();
  const announce = await page.evaluate(async () => {
    const stepper = window.stepper.createStepper({
      display: "progress",
      steps: [
        { value: "a", label: "First", content: "one" },
        { value: "b", label: "Second", content: "two" },
      ],
    });
    document.body.append(stepper.element);
    const progress = stepper.element.querySelector('[role="progressbar"]');
    const live = stepper.element.querySelector(".mtrl-stepper__live");
    const creation = { valueText: progress.getAttribute("aria-valuetext"), live: live.textContent };
    await stepper.next();
    const moved = { valueText: progress.getAttribute("aria-valuetext"), live: live.textContent };
    stepper.reset();
    const reset = { live: live.textContent };
    stepper.setSteps([
      { value: "x", label: "X", disabled: true },
      { value: "y", label: "Y", disabled: true },
    ]);
    const empty = { valueText: progress.getAttribute("aria-valuetext"), now: progress.getAttribute("aria-valuenow") };
    stepper.element.remove();

    document.body.innerHTML = `<m-stepper linear display="labels">
      <m-step value="a" label="A" no-edit><button type="button" data-stepper-next>Next</button></m-step>
      <m-step value="b" label="B"></m-step></m-stepper>`;
    window.stepper.defineStepper();
    const host = document.querySelector("m-stepper");
    await host.next();
    const component = host.component;
    host.setAttribute("display", "dots");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const switched = {
      same: host.component === component,
      completed: host.getSteps()[0].completed,
      prev: await host.prev(),
    };
    // Clearing the attribute returns to labels, still without a rebuild
    host.removeAttribute("display");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const cleared = {
      same: host.component === component,
      labels: host.shadowRoot.querySelector(".mtrl-stepper").classList.contains("mtrl-stepper--display-labels"),
      listVisible: host.shadowRoot.querySelector(".mtrl-stepper__list").getBoundingClientRect().height > 0,
      completed: host.getSteps()[0].completed,
    };
    return { creation, moved, reset, empty, switched, cleared };
  });
  assert.deepEqual(announce.creation, { valueText: "Step 1 of 2: First", live: "Step 1 of 2: First" });
  assert.deepEqual(announce.moved, { valueText: "Step 2 of 2: Second", live: "Step 2 of 2: Second" });
  assert.deepEqual(announce.reset, { live: "Step 1 of 2: First" });
  assert.deepEqual(announce.empty, { valueText: "", now: "0" });
  assert.deepEqual(announce.switched, { same: true, completed: true, prev: false });
  assert.deepEqual(announce.cleared, { same: true, labels: true, listVisible: true, completed: true });

  assert.deepEqual(errors, []);
  console.log("Stepper passes browser focus eligibility, panel and heading fallbacks, header focus, validationerror, slotted content, the compact displays, the vertical bottom label as an end label, and the truncated horizontal labels.");
} finally {
  await browser?.close();
  await server.close();
}
