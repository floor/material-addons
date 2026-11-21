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
  // A resize loop surfaces as a console error rather than a page error
  page.on("console", (message) => {
    if (message.type() === "error" && /ResizeObserver loop/i.test(message.text())) errors.push(message.text());
  });
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

  // A row that does not fit switches to compact labels: the inactive steps
  // show their indicator only (still announced), the active step keeps a
  // truncated label inside its header, the rail stays between the indicators,
  // nothing scrolls, no button overlaps, and the focus ring is whole
  await reset();
  const compactLabels = await page.evaluate(async () => {
    document.body.replaceChildren();
    const stepper = window.stepper.createStepper({
      orientation: "horizontal",
      steps: ["Store", "Pickup time and address", "Review the order", "Confirm and pay"].map((label, index) => ({
        value: `step-${index}`, label, content: `Panel ${index}`,
      })),
    });
    stepper.element.style.width = "312px";
    document.body.append(stepper.element);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const root = stepper.element;
    const list = root.querySelector(".mtrl-stepper__list");
    const items = [...root.querySelectorAll(".mtrl-stepper__item")];
    const headers = items.map((item) => item.querySelector(".mtrl-stepper__header"));
    const groups = items.map((item) => item.querySelector(".mtrl-stepper__label-group"));
    const labels = items.map((item) => item.querySelector(".mtrl-stepper__label"));
    const connectors = items.map((item) => item.querySelector(".mtrl-stepper__connector"));
    const box = (node) => (node ? node.getBoundingClientRect() : null);
    const boxes = headers.map(box);
    const activeIndex = items.findIndex((item) => item.classList.contains("mtrl-stepper__item--active"));
    const activeBox = box(headers[activeIndex]);
    headers[activeIndex].focus();
    return {
      compact: root.classList.contains("mtrl-stepper--compact-labels"),
      activeIndex,
      overflow: list.scrollWidth > list.clientWidth + 1,
      overlaps: boxes.some((entry, index) => index > 0 && entry.left < boxes[index - 1].right - 0.5),
      inactiveClipped: groups.filter((_, index) => index !== activeIndex).every((group) => box(group).width <= 1 && group.textContent.trim().length > 0),
      activeVisible: box(groups[activeIndex]).width > 24,
      activeInside: Math.round(box(labels[activeIndex]).right) <= Math.round(activeBox.right) + 1,
      activeTruncates: labels[activeIndex].scrollWidth > labels[activeIndex].clientWidth,
      rail: connectors.filter((node) => box(node).width > 0).map((node) => Math.round(box(node).width)),
      listOverflowStyle: getComputedStyle(list).overflow,
      rootOverflowStyle: getComputedStyle(root).overflow,
      names: headers.map((header) => header.textContent.trim()),
    };
  });
  assert.equal(compactLabels.compact, true, "312px four steps: the compact label class is on");
  assert.equal(compactLabels.overflow, false, "312px four steps: nothing scrolls");
  assert.equal(compactLabels.overlaps, false, "312px four steps: the step buttons do not overlap");
  assert.equal(compactLabels.inactiveClipped, true, "312px four steps: inactive labels are visually hidden but keep their text");
  assert.equal(compactLabels.activeVisible, true, "312px four steps: the active label keeps a box");
  assert.equal(compactLabels.activeInside, true, "312px four steps: the active label stays inside its header");
  assert.equal(compactLabels.activeTruncates, true, "312px four steps: the active label truncates");
  assert.ok(compactLabels.rail.length > 0 && compactLabels.rail.every((width) => width >= 8), `312px four steps: the rail stays between the indicators (${compactLabels.rail.join(", ")})`);
  assert.equal(compactLabels.listOverflowStyle, "visible", "312px four steps: the list is not a scroll container");
  assert.equal(compactLabels.rootOverflowStyle, "visible", "312px four steps: the stepper is not a scroll container");
  const expectedNames = ["Store", "Pickup time and address", "Review the order", "Confirm and pay"];
  assert.deepEqual(
    compactLabels.names.map((name, index) => name.endsWith(expectedNames[index])),
    [true, true, true, true],
    `312px four steps: every header keeps its full name (${compactLabels.names.join(" | ")})`,
  );

  // Short labels that fit stay out of compact mode, and the decision follows
  // the steps: adding a long one enters it, replacing them with short ones
  // leaves it without a stale threshold
  await reset();
  const shortLabels = await page.evaluate(async () => {
    document.body.replaceChildren();
    const stepper = window.stepper.createStepper({
      orientation: "horizontal",
      steps: ["Store", "Pay", "Done"].map((label, index) => ({ value: `step-${index}`, label, content: `Panel ${index}` })),
    });
    stepper.element.style.width = "480px";
    document.body.append(stepper.element);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 120));
    const compact = () => stepper.element.classList.contains("mtrl-stepper--compact-labels");
    await settle();
    const fitted = compact();
    stepper.setSteps([
      { value: "one", label: "Store pickup", content: "One" },
      { value: "two", label: "Pickup time and address", content: "Two" },
      { value: "three", label: "Review the order", content: "Three" },
      { value: "four", label: "Confirm and pay", content: "Four" },
    ]);
    await settle();
    const grown = compact();
    stepper.setSteps([
      { value: "a", label: "Start", content: "A" },
      { value: "b", label: "End", content: "B" },
    ]);
    await settle();
    const shrunk = compact();
    return { fitted, grown, shrunk };
  });
  assert.deepEqual(shortLabels, { fitted: false, grown: true, shrunk: false }, "the compact decision follows the measured labels and the steps");

  // Bottom placement in a narrow row: compact enters on a resize and the active
  // label stays inside its header
  await reset();
  const bottomNarrow = await page.evaluate(async () => {
    document.body.replaceChildren();
    const stepper = window.stepper.createStepper({
      orientation: "horizontal",
      labelPlacement: "bottom",
      steps: ["Store", "Pickup time and address", "Review the order"].map((label, index) => ({
        value: `step-${index}`, label, content: `Panel ${index}`,
      })),
    });
    stepper.element.style.width = "880px";
    document.body.append(stepper.element);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 120));
    await settle();
    const wide = stepper.element.classList.contains("mtrl-stepper--compact-labels");
    stepper.element.style.width = "312px";
    await settle();
    const items = [...stepper.element.querySelectorAll(".mtrl-stepper__item")];
    const active = items.find((item) => item.classList.contains("mtrl-stepper__item--active"));
    const header = active.querySelector(".mtrl-stepper__header").getBoundingClientRect();
    const label = active.querySelector(".mtrl-stepper__label").getBoundingClientRect();
    const list = stepper.element.querySelector(".mtrl-stepper__list");
    return {
      wide,
      compact: stepper.element.classList.contains("mtrl-stepper--compact-labels"),
      inside: Math.round(label.left) >= Math.round(header.left) - 1 && Math.round(label.right) <= Math.round(header.right) + 1,
      clipped: [...stepper.element.querySelectorAll(".mtrl-stepper__label")].filter((node) => node.scrollWidth > node.clientWidth + 1).length,
      overflow: list.scrollWidth > list.clientWidth + 1,
    };
  });
  assert.equal(bottomNarrow.wide, false, "bottom 880px: the labels fit, no compact");
  // At 312px the bottom labels wrap into their headers, which is full mode
  // fitting; if compact is taken instead, the active label must sit inside it
  if (bottomNarrow.compact) assert.equal(bottomNarrow.inside, true, "bottom 312px: the active label stays inside its header");
  else assert.equal(bottomNarrow.clipped, 0, "bottom 312px: full mode shows every label unclipped");
  assert.equal(bottomNarrow.overflow, false, "bottom 312px: nothing scrolls");

  // The four-title fixture at 880px stays in full mode, as main shows it: the
  // labels wrap into their share instead of being sent to compact
  await reset();
  const wideTitles = await page.evaluate(async () => {
    document.body.replaceChildren();
    const stepper = window.stepper.createStepper({
      orientation: "horizontal",
      steps: ["Store", "Pickup time and address", "Review the order", "Confirm and pay"].map((label, index) => ({
        value: `step-${index}`, label, content: `Panel ${index}`,
      })),
    });
    stepper.element.style.width = "880px";
    document.body.append(stepper.element);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const labels = [...stepper.element.querySelectorAll(".mtrl-stepper__label")];
    return {
      compact: stepper.element.classList.contains("mtrl-stepper--compact-labels"),
      clipped: labels.filter((label) => label.scrollWidth > label.clientWidth + 1).length,
    };
  });
  assert.equal(wideTitles.compact, false, "880px four titles: full mode, as main shows it");
  assert.equal(wideTitles.clipped, 0, `880px four titles: no label is clipped (${wideTitles.clipped})`);

  // Uneven labels at 500px: the widest step decides, so full mode never clips
  await reset();
  const uneven = await page.evaluate(async () => {
    document.body.replaceChildren();
    const stepper = window.stepper.createStepper({
      orientation: "horizontal",
      steps: [
        { value: "a", label: "A", content: "Panel a" },
        { value: "b", label: "Pickup time and address", content: "Panel b" },
        { value: "c", label: "C", content: "Panel c" },
      ],
    });
    stepper.element.style.width = "500px";
    document.body.append(stepper.element);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 120));
    await settle();
    const labels = [...stepper.element.querySelectorAll(".mtrl-stepper__label")];
    const activeLabel = stepper.element.querySelector(".mtrl-stepper__item--active .mtrl-stepper__label");
    const activeHeader = stepper.element.querySelector(".mtrl-stepper__item--active .mtrl-stepper__header");
    const narrow = {
      compact: stepper.element.classList.contains("mtrl-stepper--compact-labels"),
      clipped: labels.filter((label) => label.scrollWidth > label.clientWidth + 1).length,
      activeInside: activeLabel && activeHeader
        ? Math.round(activeLabel.getBoundingClientRect().right) <= Math.round(activeHeader.getBoundingClientRect().right) + 1
        : true,
    };
    // The same uneven labels with room: full mode shows all of them, unclipped
    stepper.element.style.width = "900px";
    await settle();
    const wide = {
      compact: stepper.element.classList.contains("mtrl-stepper--compact-labels"),
      clipped: labels.filter((label) => label.scrollWidth > label.clientWidth + 1).length,
    };
    return { narrow, wide };
  });
  // The widest step must not be clipped by an average: at 500px the row either
  // stays full with everything shown or compacts, and the labels are whole
  if (uneven.narrow.compact) assert.equal(uneven.narrow.activeInside, true, "500px uneven labels: the active label stays inside its header");
  else assert.equal(uneven.narrow.clipped, 0, `500px uneven labels: full mode shows every label unclipped (${uneven.narrow.clipped})`);
  assert.equal(uneven.wide.compact, false, "900px uneven labels: full mode fits");
  assert.equal(uneven.wide.clipped, 0, `900px uneven labels: no label is clipped in full mode (${uneven.wide.clipped})`);

  // Seven and eight steps at 312px: the icon row cannot hold them either, so
  // the dots display takes over
  for (const count of [7, 8]) {
    await reset();
    const many = await page.evaluate(async (steps) => {
      document.body.replaceChildren();
      const stepper = window.stepper.createStepper({
        orientation: "horizontal",
        steps: Array.from({ length: steps }, (_, index) => ({
          value: `step-${index}`, label: `Step ${index + 1}`, content: `Panel ${index}`,
        })),
      });
      stepper.element.style.width = "312px";
      document.body.append(stepper.element);
      await new Promise((resolve) => setTimeout(resolve, 120));
      const root = stepper.element;
      const list = root.querySelector(".mtrl-stepper__list");
      const boxes = [...root.querySelectorAll(".mtrl-stepper__header")].map((header) => header.getBoundingClientRect());
      // Selecting any step widens the active dot: the row must stay inside the
      // host for every one of them
      const selectedOverflow = [];
      for (let step = 0; step < steps; step += 1) {
        stepper.setValue(`step-${step}`);
        await new Promise((resolve) => setTimeout(resolve, 60));
        selectedOverflow.push(list.scrollWidth <= list.clientWidth + 1);
      }
      return {
        dots: root.classList.contains("mtrl-stepper--display-dots"),
        dotsFallback: root.classList.contains("mtrl-stepper--compact-dots"),
        overlap: boxes.some((box, index) => index > 0 && box.left < boxes[index - 1].right - 0.5),
        overflow: list.scrollWidth > list.clientWidth + 1,
        names: [...root.querySelectorAll(".mtrl-stepper__header")].map((header) => header.textContent.trim()),
        selectedOverflow,
      };
    }, count);
    assert.equal(many.dots, true, `${count} steps at 312px: the dots display takes over`);
    assert.equal(many.dotsFallback, true, `${count} steps at 312px: the fallback is marked`);
    assert.equal(many.overlap, false, `${count} steps at 312px: the buttons do not overlap`);
    assert.equal(many.overflow, false, `${count} steps at 312px: nothing scrolls`);
    assert.equal(many.names.length, count, `${count} steps at 312px: every header keeps its name`);
    assert.deepEqual(many.selectedOverflow, Array.from({ length: count }, () => true), `${count} steps at 312px: selecting any step keeps the row inside its host`);
  }

  // Crossings between full, compact, icon and dots rows raise no error: the
  // observed height changes with every transition, so the decision ignores
  // height-only entries and defers its class write
  await reset();
  const crossings = await page.evaluate(async () => {
    document.body.replaceChildren();
    const steps = (count) => Array.from({ length: count }, (_, index) => ({
      value: `step-${index}`, label: `Step ${index + 1} with a longer title`, content: `Panel ${index}`,
    }));
    const states = [];
    const settle = () => new Promise((resolve) => setTimeout(resolve, 140));
    for (const width of [880, 500, 312, 880, 500, 312]) {
      document.body.replaceChildren();
      const stepper = window.stepper.createStepper({ orientation: "horizontal", steps: steps(width <= 312 ? 8 : 4) });
      stepper.element.style.width = `${width}px`;
      document.body.append(stepper.element);
      await settle();
      for (const target of [500, 312, 880].filter((value) => value !== width)) {
        stepper.element.style.width = `${target}px`;
        await settle();
      }
      states.push(width);
      stepper.destroy();
    }
    return states;
  });
  assert.equal(crossings.length, 6, "the crossings ran");
  const loopErrors = errors.filter((error) => /ResizeObserver loop/i.test(error));
  assert.deepEqual(loopErrors, [], `no resize loop across the compact, icon and dots transitions (${loopErrors.join(" | ")})`);

  // The bottom placement keeps the same discipline: its stacked headers may
  // let a wrapped label paint outside its header, which does not count as
  // fitting — seven and eight steps take the dots fallback, and a three-step
  // row keeps its labels inside their headers
  for (const count of [7, 8]) {
    await reset();
    const bottomMany = await page.evaluate(async (steps) => {
      document.body.replaceChildren();
      const stepper = window.stepper.createStepper({
        orientation: "horizontal",
        labelPlacement: "bottom",
        steps: Array.from({ length: steps }, (_, index) => ({
          value: `step-${index}`, label: `Step ${index + 1} with a longer title`, content: `Panel ${index}`,
        })),
      });
      stepper.element.style.width = "312px";
      document.body.append(stepper.element);
      await new Promise((resolve) => setTimeout(resolve, 140));
      const root = stepper.element;
      const list = root.querySelector(".mtrl-stepper__list");
      const boxes = [...root.querySelectorAll(".mtrl-stepper__header")].map((header) => header.getBoundingClientRect());
      return {
        dots: root.classList.contains("mtrl-stepper--display-dots"),
        dotsFallback: root.classList.contains("mtrl-stepper--compact-dots"),
        overlap: boxes.some((box, index) => index > 0 && box.left < boxes[index - 1].right - 0.5),
        overflow: list.scrollWidth > list.clientWidth + 1,
      };
    }, count);
    assert.equal(bottomMany.dots, true, `bottom ${count} steps at 312px: the dots fallback takes over`);
    assert.equal(bottomMany.dotsFallback, true, `bottom ${count} steps at 312px: the fallback is marked`);
    assert.equal(bottomMany.overlap, false, `bottom ${count} steps at 312px: the buttons do not overlap`);
    assert.equal(bottomMany.overflow, false, `bottom ${count} steps at 312px: nothing scrolls`);
  }

  await reset();
  const bottomThree = await page.evaluate(async () => {
    document.body.replaceChildren();
    const stepper = window.stepper.createStepper({
      orientation: "horizontal",
      labelPlacement: "bottom",
      steps: ["Store", "Pickup time and address", "Review the order"].map((label, index) => ({
        value: `step-${index}`, label, content: `Panel ${index}`,
      })),
    });
    stepper.element.style.width = "312px";
    document.body.append(stepper.element);
    await new Promise((resolve) => setTimeout(resolve, 140));
    const root = stepper.element;
    const list = root.querySelector(".mtrl-stepper__list");
    const escapes = [...root.querySelectorAll(".mtrl-stepper__label")].some((label) => {
      const header = label.closest(".mtrl-stepper__header").getBoundingClientRect();
      const box = label.getBoundingClientRect();
      return box.width > 0 && (box.left < header.left - 1 || box.right > header.right + 1);
    });
    return {
      escapes,
      overflow: list.scrollWidth > list.clientWidth + 1,
      compact: root.classList.contains("mtrl-stepper--compact-labels"),
    };
  });
  assert.equal(bottomThree.escapes, false, "bottom 312px three titles: no label paints outside its header");
  assert.equal(bottomThree.overflow, false, "bottom 312px three titles: nothing scrolls");

  // Six steps in 312px cannot hold a label: every step shows its indicator
  await reset();
  const icons = await page.evaluate(async () => {
    document.body.replaceChildren();
    const stepper = window.stepper.createStepper({
      orientation: "horizontal",
      steps: Array.from({ length: 6 }, (_, index) => ({
        value: `step-${index}`, label: `Step ${index + 1} with a longer title`, content: `Panel ${index}`,
      })),
    });
    stepper.element.style.width = "312px";
    document.body.append(stepper.element);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const root = stepper.element;
    const list = root.querySelector(".mtrl-stepper__list");
    const groups = [...root.querySelectorAll(".mtrl-stepper__label-group")];
    const box = (node) => node.getBoundingClientRect();
    return {
      compact: root.classList.contains("mtrl-stepper--compact-labels"),
      icons: root.classList.contains("mtrl-stepper--compact-icons"),
      allClipped: groups.every((group) => box(group).width <= 1),
      overlap:
        [...root.querySelectorAll(".mtrl-stepper__header")]
          .map(box)
          .some((entry, index, all) => index > 0 && entry.left < all[index - 1].right - 0.5),
      overflow: list.scrollWidth > list.clientWidth + 1,
    };
  });
  assert.equal(icons.compact, true, "six steps at 312px: compact");
  assert.equal(icons.icons, true, "six steps at 312px: the last-resort icon row");
  assert.equal(icons.allClipped, true, "six steps at 312px: no label keeps a visible box");
  assert.equal(icons.overlap, false, "six steps at 312px: the buttons do not overlap");
  assert.equal(icons.overflow, false, "six steps at 312px: nothing scrolls");

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
  console.log("Stepper passes browser focus eligibility, panel and heading fallbacks, header focus, validationerror, slotted content, the compact displays, the vertical bottom label as an end label, the compact label row with its step-driven threshold, and the last-resort icon row.");
} finally {
  await browser?.close();
  await server.close();
}
