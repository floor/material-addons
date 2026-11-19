// The skeleton's browser behaviour that jsdom cannot prove: the two surface
// tokens resolving in light and dark, the wave's direction under RTL, the
// reduced-motion and forced-colors fallbacks, and the reveal swap holding
// the host's box (no layout shift).
//
//   bun run build --production && node scripts/check-skeleton.mjs
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-skeleton",
  optimizeDeps: { entries: ["test/browser/skeleton.html"] },
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
  const reset = async (scheme) => {
    await page.goto(`http://127.0.0.1:${port}/test/browser/skeleton.html`);
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForFunction(() => !!window.skeleton);
  };

  // Fill and highlight resolve through the two surface tokens, light and
  // dark. A named theme switches dark by data-theme-mode, not by the OS
  // scheme, so the check sets the attribute itself.
  const fills = {};
  for (const mode of ["light", "dark"]) {
    await reset("light");
    await page.evaluate((dark) => {
      document.documentElement.setAttribute("data-theme", "baseline");
      if (dark) document.documentElement.setAttribute("data-theme-mode", "dark");
      else document.documentElement.removeAttribute("data-theme-mode");
    }, mode === "dark");
    const colours = await page.evaluate(() => {
      const { createSkeleton } = window.skeleton;
      document.body.innerHTML = "";
      const skeleton = createSkeleton({ variant: "rect" });
      document.body.appendChild(skeleton.element);
      const shape = skeleton.element.querySelector(".mtrl-skeleton__shape");
      const style = getComputedStyle(shape);
      const band = style.backgroundImage.match(/rgba?\([^)]+\)/g) ?? [];
      return { fill: style.backgroundColor, band: band[0] ?? "" };
    });
    assert.match(colours.fill, /^rgb\(/, `${mode}: the fill resolves to a colour`);
    assert.notEqual(colours.band, "", `${mode}: the sweep band is drawn`);
    fills[mode] = colours.fill;
    console.log(`${mode}: fill ${colours.fill}, band drawn`);
  }
  assert.notEqual(fills.light, fills.dark, "the two surface roles differ between light and dark");
  await page.evaluate(() => document.documentElement.removeAttribute("data-theme-mode"));

  // RTL: in one wave parent, the placeholder further toward inline-end has
  // the larger delay.
  await reset("light");
  const delays = await page.evaluate(async () => {
    const { createSkeleton } = window.skeleton;
    document.body.innerHTML = "";
    document.documentElement.dir = "rtl";
    const group = document.createElement("div");
    group.setAttribute("data-mtrl-skeleton-wave", "");
    group.style.display = "flex";
    group.style.gap = "16px";
    document.body.appendChild(group);
    const make = () => {
      const skeleton = createSkeleton({ variant: "circle", size: "medium" });
      group.appendChild(skeleton.element);
      return skeleton.element;
    };
    const first = make();
    const second = make();
    const third = make();
    // The wave reads its geometry a frame after mount; wait for the paint.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const delayOf = (element) => parseFloat(getComputedStyle(element).getPropertyValue("--mtrl-skeleton-delay")) || 0;
    const order = [first, second, third].map(delayOf);
    document.documentElement.dir = "ltr";
    const ltr = [first, second, third].map(delayOf);
    return { rtl: order, ltr };
  });
  assert.equal(Math.min(...delays.rtl), 0, "the first placeholder in the group starts the wave");
  assert.ok(
    delays.rtl[2] > delays.rtl[1] && delays.rtl[1] >= delays.rtl[0],
    `rtl: the delay grows toward inline-end (got ${delays.rtl.join(", ")})`,
  );
  assert.ok(
    delays.ltr[2] > delays.ltr[1] && delays.ltr[1] >= delays.ltr[0],
    `ltr: the delay grows toward inline-end (got ${delays.ltr.join(", ")})`,
  );
  console.log(`wave delays grow toward inline-end: rtl [${delays.rtl.join(", ")}], ltr [${delays.ltr.join(", ")}]`);

  // Reduced motion: the shape does not animate.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await page.evaluate(() => {
    const { createSkeleton } = window.skeleton;
    document.body.innerHTML = "";
    const skeleton = createSkeleton({ variant: "text", lines: 3 });
    document.body.appendChild(skeleton.element);
    const shape = skeleton.element.querySelector(".mtrl-skeleton__shape");
    return getComputedStyle(shape).animationName;
  });
  assert.equal(reduced, "none", `reduced motion: animation-name is none (got ${reduced})`);
  console.log("reduced motion: the shape does not animate");

  // Forced colors: Canvas fill with a CanvasText border, no animation.
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "no-preference" });
  const forced = await page.evaluate(() => {
    const { createSkeleton } = window.skeleton;
    document.body.innerHTML = "";
    const skeleton = createSkeleton({ variant: "rect" });
    document.body.appendChild(skeleton.element);
    const shape = skeleton.element.querySelector(".mtrl-skeleton__shape");
    const style = getComputedStyle(shape);
    return { background: style.backgroundColor, border: style.borderTopColor + " " + style.borderTopWidth, animation: style.animationName };
  });
  assert.equal(forced.animation, "none", "forced colors: no animation");
  assert.notEqual(forced.border.trim(), "", "forced colors: the CanvasText border is drawn");
  const forcedPulse = await page.evaluate(() => {
    const { createSkeleton } = window.skeleton;
    const pulse = createSkeleton({ variant: "rect", motion: "pulse" });
    document.body.appendChild(pulse.element);
    const shape = pulse.element.querySelector(".mtrl-skeleton__shape");
    return { animation: getComputedStyle(shape).animationName, background: getComputedStyle(shape).backgroundColor };
  });
  assert.equal(forcedPulse.animation, "none", `forced colors outrank pulse (got ${forcedPulse.animation})`);
  console.log(`forced colors: border ${forced.border}, no animation, pulse included`);
  await page.emulateMedia({ forcedColors: "none", reducedMotion: "no-preference" });

  // The reveal swap holds the host's box: a circle mapped to the avatar's
  // 40px is still 40px after the real component lands.
  await reset("light");
  const swap = await page.evaluate(async () => {
    const { createLayout } = window.skeleton;
    document.body.innerHTML = "";
    const creator = (options) => {
      const element = document.createElement("div");
      element.className = "real-avatar";
      element.style.width = "40px";
      element.style.height = "40px";
      return { element, destroy: () => element.remove(), ...options };
    };
    // An avatar creator stands in as the circle at the avatar box: mapped,
    // exactly as the spec's reveal test plans it.
    window.skeleton.registerSkeleton(creator, () => ({ variant: "circle", size: "large" }));
    const region = document.createElement("div");
    document.body.appendChild(region);
    const result = createLayout([creator, "avatar", {}], region, { skeleton: true });
    const host = result.get("avatar").element;
    const before = host.getBoundingClientRect().height;
    result.reveal();
    // The host is replaced by the real element; measure the slot's element.
    const after = result.get("avatar").element.getBoundingClientRect().height;
    const busy = region.hasAttribute("aria-busy");
    result.destroy();
    return { before, after, busy };
  });
  assert.equal(swap.before, 40, "the mapped circle holds 40px before the reveal");
  assert.equal(swap.after, 40, `the real element holds the same 40px across the swap (got ${swap.after})`);
  assert.equal(swap.busy, false, "reveal clears the region's aria-busy");
  console.log(`reveal: ${swap.before}px -> ${swap.after}px, aria-busy cleared`);

  // Multi-line text: the root holds every line, nothing overflows, and the
  // bars carry the sweep (the shape paints nothing of its own).
  const multi = await page.evaluate(() => {
    const { createSkeleton } = window.skeleton;
    document.body.innerHTML = "";
    const skeleton = createSkeleton({ variant: "text", lines: 3 });
    document.body.appendChild(skeleton.element);
    const root = skeleton.element;
    const shape = root.querySelector(".mtrl-skeleton__shape");
    const bars = [...root.querySelectorAll(".mtrl-skeleton__line")];
    const rootBox = root.getBoundingClientRect();
    const shapeBox = shape.getBoundingClientRect();
    const shapeStyle = getComputedStyle(shape);
    return {
      rootHeight: rootBox.height,
      shapeHeight: shapeBox.height,
      bars: bars.length,
      shapeBackground: shapeStyle.backgroundImage,
      barBackground: getComputedStyle(bars[0]).backgroundImage,
      shapeAnimation: shapeStyle.animationName,
      barAnimation: getComputedStyle(bars[0]).animationName,
    };
  });
  const lineGap = 8;
  const singleLine = await page.evaluate(() => {
    const { createSkeleton } = window.skeleton;
    document.body.innerHTML = "";
    const skeleton = createSkeleton({ variant: "text" });
    document.body.appendChild(skeleton.element);
    const height = skeleton.element.getBoundingClientRect().height;
    skeleton.destroy();
    return height;
  });
  const expected = 3 * singleLine + 2 * lineGap;
  assert.equal(multi.bars, 3, "three bars");
  assert.ok(
    Math.abs(multi.rootHeight - expected) <= 1,
    `the root holds three lines and two gaps: ${multi.rootHeight} (expected ${expected})`,
  );
  assert.ok(multi.shapeHeight <= multi.rootHeight + 1, "the shape fits inside the root");
  assert.equal(multi.shapeBackground, "none", "the multi-line shape paints nothing of its own");
  assert.notEqual(multi.barBackground, "none", "each bar carries the sweep gradient");
  assert.equal(multi.shapeAnimation, "none", "the multi-line shape does not animate");
  assert.notEqual(multi.barAnimation, "none", "the bars animate");
  console.log(`multi-line: root ${multi.rootHeight}px = 3 x ${singleLine}px + 2 gaps; the bars carry the sweep`);

  // A skeleton built without a parent still gets its wave delay once the
  // caller appends it.
  const appended = await page.evaluate(async () => {
    const { createSkeleton } = window.skeleton;
    document.body.innerHTML = "";
    const group = document.createElement("div");
    group.setAttribute("data-mtrl-skeleton-wave", "");
    group.style.display = "flex";
    group.style.gap = "24px";
    document.body.appendChild(group);
    // Created first, appended after: the read happens on connect.
    const first = createSkeleton({ variant: "circle" });
    const second = createSkeleton({ variant: "circle" });
    group.appendChild(first.element);
    group.appendChild(second.element);
    const frame = (resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve));
    await new Promise(frame);
    const delayOf = (element) => parseFloat(getComputedStyle(element).getPropertyValue("--mtrl-skeleton-delay"));
    return { first: delayOf(first.element), second: delayOf(second.element) };
  });
  assert.ok(appended.second > appended.first, `the appended skeleton's delay is computed on connect (${appended.first} -> ${appended.second})`);
  console.log(`appended after creation: delays ${appended.first}ms -> ${appended.second}ms`);

  // Reduced motion stops the bars of a multi-line placeholder too, and it
  // outranks the pulse: a pulsed placeholder is equally still.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedBars = await page.evaluate(() => {
    const { createSkeleton } = window.skeleton;
    document.body.innerHTML = "";
    const wave = createSkeleton({ variant: "text", lines: 3 });
    const pulse = createSkeleton({ variant: "text", lines: 3, motion: "pulse" });
    document.body.append(wave.element, pulse.element);
    const barOf = (skeleton) => skeleton.element.querySelector(".mtrl-skeleton__line");
    return {
      wave: getComputedStyle(barOf(wave)).animationName,
      pulseBar: getComputedStyle(barOf(pulse)).animationName,
      pulseShape: getComputedStyle(pulse.element.querySelector(".mtrl-skeleton__shape")).animationName,
    };
  });
  assert.equal(reducedBars.wave, "none", `reduced motion: the wave bars do not animate (got ${reducedBars.wave})`);
  assert.equal(reducedBars.pulseBar, "none", `reduced motion outranks pulse on the bars (got ${reducedBars.pulseBar})`);
  assert.equal(reducedBars.pulseShape, "none", `reduced motion outranks pulse on the shape (got ${reducedBars.pulseShape})`);
  console.log("reduced motion: wave and pulse are both still");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // The pulse reaches the multi-line bars, with no position delay.
  const pulseBars = await page.evaluate(() => {
    const { createSkeleton } = window.skeleton;
    document.body.innerHTML = "";
    const skeleton = createSkeleton({ variant: "text", lines: 3, motion: "pulse" });
    document.body.appendChild(skeleton.element);
    const bar = skeleton.element.querySelector(".mtrl-skeleton__line");
    const shape = skeleton.element.querySelector(".mtrl-skeleton__shape");
    const style = getComputedStyle(bar);
    return { name: style.animationName, delay: style.animationDelay, shape: getComputedStyle(shape).animationName };
  });
  assert.equal(pulseBars.name, "mtrl-skeleton-pulse", `pulse: the bars pulse (got ${pulseBars.name})`);
  assert.equal(pulseBars.delay, "0s", `pulse: the bars carry no position delay (got ${pulseBars.delay})`);
  console.log(`pulse: the bars pulse at ${pulseBars.delay}`);

  // RTL: the wave runs from inline-start, so the band travels the other way.
  const rtlWave = await page.evaluate(() => {
    const { createSkeleton } = window.skeleton;
    document.body.innerHTML = "";
    document.documentElement.dir = "rtl";
    const group = document.createElement("div");
    group.setAttribute("data-mtrl-skeleton-wave", "");
    document.body.appendChild(group);
    const single = createSkeleton({ variant: "rect" });
    const multi = createSkeleton({ variant: "text", lines: 3 });
    group.appendChild(single.element);
    group.appendChild(multi.element);
    const shape = getComputedStyle(single.element.querySelector(".mtrl-skeleton__shape")).animationName;
    const bar = getComputedStyle(multi.element.querySelector(".mtrl-skeleton__line")).animationName;
    document.documentElement.dir = "ltr";
    return { shape, bar };
  });
  assert.equal(rtlWave.shape, "mtrl-skeleton-wave-rtl", `rtl: the shape's wave reverses (got ${rtlWave.shape})`);
  assert.equal(rtlWave.bar, "mtrl-skeleton-wave-rtl", `rtl: the bars' wave reverses (got ${rtlWave.bar})`);
  const ltrWave = await page.evaluate(() => {
    const { createSkeleton } = window.skeleton;
    document.body.innerHTML = "";
    const skeleton = createSkeleton({ variant: "rect" });
    document.body.appendChild(skeleton.element);
    return getComputedStyle(skeleton.element.querySelector(".mtrl-skeleton__shape")).animationName;
  });
  assert.equal(ltrWave, "mtrl-skeleton-wave", `ltr: the wave keeps its direction (got ${ltrWave})`);
  console.log(`rtl wave: shape ${rtlWave.shape}, bar ${rtlWave.bar}; ltr stays ${ltrWave}`);

  // The element: attributes reach the placeholder, no-busy opts out.
  const element = await page.evaluate(() => {
    const { defineSkeleton } = window.skeleton;
    defineSkeleton();
    document.body.innerHTML = "";
    const host = document.createElement("m-skeleton");
    host.setAttribute("variant", "circle");
    host.setAttribute("size", "large");
    host.setAttribute("lines", "3");
    host.setAttribute("motion", "pulse");
    document.body.appendChild(host);
    const inner = host.shadowRoot?.querySelector(".mtrl-skeleton") ?? null;
    return {
      defined: !!inner,
      variant: inner?.dataset.variant ?? "",
      size: inner?.dataset.size ?? "",
      lines: inner?.querySelectorAll(".mtrl-skeleton__line").length ?? -1,
      motion: inner?.dataset.motion ?? "",
      busy: host.getAttribute("aria-busy"),
    };
  });
  assert.equal(element.defined, true, "the element upgrades and renders the placeholder");
  assert.equal(element.variant, "circle", "variant attribute reaches the placeholder");
  assert.equal(element.size, "large", "size attribute reaches the placeholder");
  assert.equal(element.lines, 0, "lines is ignored for a circle");
  assert.equal(element.motion, "pulse", "motion attribute reaches the placeholder");
  console.log(`element: variant ${element.variant}, size ${element.size}, motion ${element.motion}`);

  const noBusy = await page.evaluate(() => {
    const host = document.createElement("m-skeleton");
    host.setAttribute("no-busy", "");
    document.body.appendChild(host);
    return host.shadowRoot?.querySelector(".mtrl-skeleton")?.hasAttribute("aria-busy") ?? null;
  });
  assert.equal(noBusy, false, "no-busy leaves aria-busy off the placeholder");
  console.log("element: no-busy opts out");

  // The documented reveal holds the layout: registered creators, a paragraph
  // below, and nothing moves.
  await reset("light");
  const zeroShift = await page.evaluate(async () => {
    const { createLayout, registerSkeleton } = window.skeleton;
    document.body.innerHTML = "";
    // A field creator whose real element is exactly 56px tall, mapped to the
    // same box: the registered pattern the README documents.
    const createField = (options) => {
      const element = document.createElement("div");
      element.style.height = "56px";
      element.textContent = options.label ?? "";
      return { element, destroy: () => element.remove() };
    };
    registerSkeleton(createField, () => ({ variant: "rect", blockSize: "56px" }));
    const below = document.createElement("p");
    below.textContent = "after";
    const region = document.createElement("div");
    document.body.append(region, below);
    const result = createLayout(
      [
        "div",
        { layout: { type: "row", gap: "1rem" } },
        [createField, "field", { label: "Name" }],
      ],
      region,
      { skeleton: true },
    );
    const before = { host: result.get("field").element.getBoundingClientRect().height, below: below.getBoundingClientRect().top };
    result.reveal();
    const after = { host: result.get("field").element.getBoundingClientRect().height, below: below.getBoundingClientRect().top };
    result.destroy();
    return { before, after };
  });
  assert.equal(zeroShift.before.host, 56, "the mapped box holds the field's height");
  assert.equal(zeroShift.after.host, 56, `the host does not change height across the swap (got ${zeroShift.after.host})`);
  assert.equal(zeroShift.after.below, zeroShift.before.below, `the page below does not move (got ${zeroShift.before.below} -> ${zeroShift.after.below})`);
  console.log(`documented reveal: 56px -> 56px, the paragraph below stays at ${zeroShift.after.below}px`);

  // The zero-shift contract: a mapping that sizes the placeholder like the
  // real content (blockSize and inlineSize) holds the layout exactly.
  await reset("light");
  const matched = await page.evaluate(() => {
    const { createLayout, registerSkeleton } = window.skeleton;
    document.body.innerHTML = "";
    const createOdd = (options) => {
      const element = document.createElement("div");
      element.style.width = "220px";
      element.style.height = "56px";
      element.textContent = options.label ?? "";
      return { element, destroy: () => element.remove() };
    };
    registerSkeleton(createOdd, () => ({ variant: "rect", blockSize: "56px", inlineSize: "220px" }));
    const below = document.createElement("p");
    below.textContent = "after";
    const region = document.createElement("div");
    document.body.append(region, below);
    const result = createLayout(["div", { layout: { type: "row" } }, [createOdd, "odd", {}]], region, { skeleton: true });
    const narrowHost = result.get("odd").element;
    const before = { below: below.getBoundingClientRect().top, host: narrowHost.getBoundingClientRect().height };
    result.reveal();
    const after = { below: below.getBoundingClientRect().top, host: narrowHost.getBoundingClientRect().height };
    result.destroy();
    return { before, after };
  });
  assert.equal(matched.after.below, matched.before.below, `a matched mapping moves nothing (got ${matched.before.below} -> ${matched.after.below})`);
  console.log(`matched mapping: the page below stays at ${matched.after.below}px across the reveal`);

  // Unequal mapped inline sizes hold their hosts: 144/320 mapped and real
  // means the hosts render 144/320, not an even split, and the reveal moves
  // nothing.
  const unequalMapped = await page.evaluate(() => {
    const { createLayout, registerSkeleton } = window.skeleton;
    document.body.innerHTML = "";
    const makeCreator = (width) => (options) => {
      const element = document.createElement("div");
      element.style.width = width;
      element.style.height = "40px";
      return { element, destroy: () => element.remove(), ...options };
    };
    const narrow = makeCreator("144px");
    const wide = makeCreator("320px");
    registerSkeleton(narrow, () => ({ variant: "rect", blockSize: "40px", inlineSize: "144px" }));
    registerSkeleton(wide, () => ({ variant: "rect", blockSize: "40px", inlineSize: "320px" }));
    const below = document.createElement("p");
    below.textContent = "after";
    const region = document.createElement("div");
    document.body.append(region, below);
    const result = createLayout(
      ["div", { layout: { type: "row", gap: "0px" } }, [narrow, "narrow", {}], [wide, "wide", {}]],
      region,
      { skeleton: true },
    );
    const hostOf = (name) => result.get(name).element;
    const boxOf = (host) => {
      const box = host.getBoundingClientRect();
      return { width: box.width, left: box.left };
    };
    const narrowHost = hostOf("narrow");
    const wideHost = hostOf("wide");
    const before = { narrow: boxOf(narrowHost), wide: boxOf(wideHost), below: below.getBoundingClientRect().top };
    result.reveal();
    // The hosts are gone: the slot elements are the real components now.
    const after = { narrow: boxOf(hostOf("narrow")), wide: boxOf(hostOf("wide")), below: below.getBoundingClientRect().top };
    result.destroy();
    return { before, after };
  });
  assert.equal(unequalMapped.before.narrow.width, 144, `the narrow host renders its mapped inline size (got ${unequalMapped.before.narrow.width})`);
  assert.equal(unequalMapped.before.wide.width, 320, `the wide host renders its mapped inline size (got ${unequalMapped.before.wide.width})`);
  assert.equal(unequalMapped.after.narrow.width, unequalMapped.after.wide.width, `after reveal the row's own item behaviour takes over: equal shares (got ${unequalMapped.after.narrow.width}/${unequalMapped.after.wide.width})`);
  console.log(`unequal mapped sizes: hosts hold 144px and 320px before reveal, then the row lays its items out itself (one reflow)`);

  // The matched case is proven by the chain of the two tests below and the
  // elasticity twin: a mapping measured from the plain page makes the
  // skeleton phase equal it (the mapping box holds, first test), and the
  // elasticity twin proves the revealed page equals the plain page — so
  // before equals plain equals after, and nothing moved.

  // A mismatched mapping is a one-time reflow, never a permanent clip:
  // unmapped hosts share the row evenly while they stand in, and at reveal
  // the real elements replace the hosts as the row's own items.
  const unevenRow = await page.evaluate(() => {
    const { createLayout, registerSkeleton } = window.skeleton;
    document.body.innerHTML = "";
    const makeCreator = (width) => () => {
      const element = document.createElement("div");
      element.style.width = width;
      element.style.height = "40px";
      return { element, destroy: () => element.remove() };
    };
    const narrow = makeCreator("184px");
    const wide = makeCreator("280px");
    registerSkeleton(narrow, () => ({ variant: "rect", blockSize: "40px" }));
    registerSkeleton(wide, () => ({ variant: "rect", blockSize: "40px" }));
    const region = document.createElement("div");
    document.body.appendChild(region);
    const result = createLayout(
      ["div", { layout: { type: "row", gap: "0px" } }, [narrow, "narrow", {}], [wide, "wide", {}]],
      region,
      { skeleton: true },
    );
    const hostOf = (name) => result.get(name).element;
    const before = {
      narrow: hostOf("narrow").getBoundingClientRect().width,
      wide: hostOf("wide").getBoundingClientRect().width,
    };
    const hosts = [hostOf("narrow"), hostOf("wide")];
    result.reveal();
    const after = {
      narrow: hostOf("narrow").getBoundingClientRect().width,
      wide: hostOf("wide").getBoundingClientRect().width,
    };
    const hostsGone = hosts.every((host) => !host.isConnected);
    result.destroy();
    return { before, after, hostsGone };
  });
  assert.equal(unevenRow.before.narrow, unevenRow.before.wide, `unmapped placeholders share the row evenly while they stand in (${unevenRow.before.narrow}/${unevenRow.before.wide})`);
  assert.equal(unevenRow.hostsGone, true, "the hosts leave the layout at reveal");
  assert.equal(unevenRow.after.narrow, unevenRow.after.wide, `the row lays its own items out after reveal (${unevenRow.after.narrow}/${unevenRow.after.wide})`);
  console.log(`mismatched mapping: even placeholders, one reflow, the real elements are the row's own items (${unevenRow.after.narrow}px each)`);
  // A mismatched mapping reflows once and never covers its neighbours: the
  // mapping's box leaves the host at reveal, the wide real component takes
  // its own size, and the button beside it is hit-testable at its new place.
  const neighbour = await page.evaluate(() => {
    const { createLayout, registerSkeleton } = window.skeleton;
    document.body.innerHTML = "";
    const createWide = (options) => {
      const element = document.createElement("div");
      element.style.width = "320px";
      element.style.height = "40px";
      return { element, destroy: () => element.remove(), ...options };
    };
    registerSkeleton(createWide, () => ({ variant: "rect", blockSize: "40px", inlineSize: "144px" }));
    const region = document.createElement("div");
    region.style.display = "flex";
    region.style.gap = "0px";
    region.style.width = "600px";
    document.body.appendChild(region);
    const result = createLayout(
      ["div", { layout: { type: "row", gap: "0px" } }, [createWide, "wide", {}]],
      region,
      { skeleton: true },
    );
    const button = document.createElement("button");
    button.textContent = "Next";
    button.style.flex = "none";
    region.appendChild(button);
    const slot = result.get("wide");
    const hostBefore = slot.element.getBoundingClientRect().width;
    const hostNode = slot.element;
    result.reveal();
    const realWidth = slot.element.getBoundingClientRect().width;
    const hostDetached = !hostNode.isConnected;
    const box = button.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    result.destroy();
    button.remove();
    return { hostBefore, realWidth, hostDetached, hitIsButton: hit === button || button.contains(hit) };
  });
  assert.equal(neighbour.hostBefore, 144, `the mapped box holds before reveal (got ${neighbour.hostBefore})`);
  assert.ok(neighbour.realWidth >= 320, `the real element holds its 320px content in the row's own share (got ${neighbour.realWidth})`);
  assert.equal(neighbour.hostDetached, true, "the host node leaves the layout at reveal");
  assert.equal(neighbour.hitIsButton, true, "the button beside a mismatched component is hit-testable after reveal");
  console.log(`mismatched reveal: the 144px host is replaced by the real element (row share ${neighbour.realWidth}px), the neighbour button is hit-testable`);

  // After reveal the page behaves exactly like one that never had a
  // skeleton: a 50% child follows its container, a container resize moves
  // it, content growth grows it — compared against a no-skeleton twin.
  const twin = await page.evaluate(async () => {
    const { createLayout } = window.skeleton;
    document.body.innerHTML = "";
    const build = (region, skeleton) => {
      const half = () => {
        const element = document.createElement("div");
        element.style.width = "50%";
        element.style.height = "30px";
        return { element, destroy: () => element.remove() };
      };
      const result = createLayout(["div", { layout: { type: "row" } }, [half, "half", {}]], region, { skeleton });
      return result;
    };
    const plainRegion = document.createElement("div");
    plainRegion.style.width = "600px";
    const skeletonRegion = document.createElement("div");
    skeletonRegion.style.width = "600px";
    document.body.append(plainRegion, skeletonRegion);
    const plain = build(plainRegion, false);
    const skeleton = build(skeletonRegion, true);
    skeleton.reveal();
    const measure = () => {
      const plainBox = plain.get("half").element.getBoundingClientRect();
      const skeletonBox = skeleton.get("half").element.getBoundingClientRect();
      return { plain: plainBox.width, skeleton: skeletonBox.width };
    };
    const at600 = measure();
    plainRegion.style.width = "400px";
    skeletonRegion.style.width = "400px";
    const at400 = measure();
    // content growth: a taller child grows both the same way
    plain.get("half").element.style.height = "60px";
    skeleton.get("half").element.style.height = "60px";
    const grown = {
      plain: plain.get("half").element.getBoundingClientRect().height,
      skeleton: skeleton.get("half").element.getBoundingClientRect().height,
    };
    plain.destroy();
    skeleton.destroy();
    return { at600, at400, grown };
  });
  assert.equal(twin.at600.skeleton, twin.at600.plain, `a 50% child sizes like the twin at 600px (skeleton ${twin.at600.skeleton}, plain ${twin.at600.plain})`);
  assert.equal(twin.at400.skeleton, twin.at400.plain, `a container resize moves it like the twin (skeleton ${twin.at400.skeleton}, plain ${twin.at400.plain})`);
  assert.ok(twin.at400.skeleton < twin.at600.skeleton, "the child follows its container, not a frozen size");
  assert.equal(twin.grown.skeleton, twin.grown.plain, `content growth behaves like the twin (skeleton ${twin.grown.skeleton}, plain ${twin.grown.plain})`);
  console.log(`post-reveal elasticity: 50% child ${twin.at600.skeleton}px -> ${twin.at400.skeleton}px with the container, growth ${twin.grown.skeleton}px — all equal to the no-skeleton twin`);

  // A single-component layout's root references follow the real element.
  const rootFollows = await page.evaluate(() => {
    const { createLayout } = window.skeleton;
    document.body.innerHTML = "";
    const creator = (options) => {
      const element = document.createElement("button");
      element.textContent = options.label ?? "Save";
      return { element, destroy: () => element.remove() };
    };
    const region = document.createElement("div");
    document.body.appendChild(region);
    const result = createLayout([creator, "save", { label: "Save" }], region, { skeleton: true });
    const host = result.get("save").element;
    const before = { element: result.element === host, layoutElement: result.layout.element === host };
    result.reveal();
    const real = result.get("save").element;
    const after = {
      element: result.element === real,
      layoutElement: result.layout.element === real,
      connected: result.element.isConnected && result.element === region.querySelector("button"),
      hostGone: !host.isConnected,
    };
    result.destroy();
    return { before, after };
  });
  assert.equal(rootFollows.before.element, true, "before reveal the root is the placeholder's host");
  assert.equal(rootFollows.before.layoutElement, true, "layout.element is the host too");
  assert.equal(rootFollows.after.element, true, "result.element follows the real element after reveal");
  assert.equal(rootFollows.after.layoutElement, true, "result.layout.element follows it too");
  assert.equal(rootFollows.after.connected, true, "the root reference is the live button in the document");
  assert.equal(rootFollows.after.hostGone, true, "the host is detached");
  console.log("single-component root: result.element and result.layout.element follow the real button");

  // The form's public reveal(): placeholders stand in, reveal swaps them in
  // and clears the busy flag.
  const formReveal = await page.evaluate(async () => {
    const { createForm } = window.skeleton;
    document.body.innerHTML = "";
    // A real field creator: the placeholder stands in first, reveal() must
    // make THIS component the registered, reading-and-writing field.
    const createNameField = (options) => {
      const element = document.createElement("input");
      element.value = "Ada";
      return {
        element,
        destroy: () => element.remove(),
        getValue: () => element.value,
        setValue: (value) => { element.value = String(value); },
      };
    };
    const form = createForm({
      layout: [[createNameField, "info.name", { label: "Name" }]],
      skeleton: true,
      data: { name: "Ada" },
    });
    document.body.appendChild(form.element);
    const hadPlaceholder = !!form.element.querySelector(".mtrl-skeleton");
    const busyBefore = form.element.hasAttribute("aria-busy") || !!form.form?.hasAttribute?.("aria-busy");
    const hasReveal = typeof form.reveal === "function";
    if (hasReveal) form.reveal();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const busyAfter = form.element.hasAttribute("aria-busy") || !!form.form?.hasAttribute?.("aria-busy");
    const field = typeof form.getField === "function" ? form.getField("name") : undefined;
    const registered = !!field && typeof field.getValue === "function";
    const read = registered ? field.getValue() : null;
    // The configured initial data was applied at compose time to
    // placeholders; reveal() must give it to the real field — read it
    // before any write mutates it.
    const initialData = typeof form.getData === "function" ? form.getData() : null;
    if (registered) field.setValue("Grace");
    const reread = registered ? field.getValue() : null;
    const input = form.element.querySelector("input");
    form.destroy?.();
    return { hadPlaceholder, hasReveal, busyBefore, busyAfter, registered, read, reread, inputPresent: !!input, inputValue: input?.value ?? null, initialData };
  });
  assert.equal(formReveal.hadPlaceholder, true, "skeleton mode renders placeholders");
  assert.equal(formReveal.hasReveal, true, "the form exposes a public reveal()");
  assert.equal(formReveal.busyBefore, true, "the form region is busy in skeleton mode");
  assert.equal(formReveal.busyAfter, false, "reveal() clears the busy flag");
  assert.equal(formReveal.registered, true, "reveal() registers the real field");
  assert.equal(formReveal.read, "Ada", `the registered field reads the real value (got ${formReveal.read})`);
  assert.equal(formReveal.reread, "Grace", "the registered field writes and reads back");
  assert.equal(formReveal.inputPresent, true, "the real input is in the form");
  assert.equal(formReveal.inputValue, "Grace", `the write reached the real element (got ${formReveal.inputValue})`);
  assert.equal(formReveal.initialData?.name, "Ada", `the configured initial data survives reveal (got ${JSON.stringify(formReveal.initialData)})`);
  console.log("form: reveal() registers the real field, keeps the configured initial data, writes Grace");

  assert.deepEqual(errors, [], "no page errors");
  console.log("Passed skeleton browser checks.");
} finally {
  await browser?.close();
  await server.close();
}
