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
  console.log(`forced colors: border ${forced.border}, no animation`);
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
    const after = host.getBoundingClientRect().height;
    const busy = region.hasAttribute("aria-busy");
    result.destroy();
    return { before, after, busy };
  });
  assert.equal(swap.before, 40, "the mapped circle holds 40px before the reveal");
  assert.equal(swap.after, 40, `the host does not change height across the swap (got ${swap.after})`);
  assert.equal(swap.busy, false, "reveal clears the region's aria-busy");
  console.log(`reveal: ${swap.before}px -> ${swap.after}px, aria-busy cleared`);

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

  assert.deepEqual(errors, [], "no page errors");
  console.log("Passed skeleton browser checks.");
} finally {
  await browser?.close();
  await server.close();
}
