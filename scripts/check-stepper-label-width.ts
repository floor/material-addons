// Run against source so the same standalone check can reproduce the old layout.
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import * as sass from "sass";

const css = sass.compile("src/styles/components/_stepper.scss", { style: "compressed" }).css;
const peer = await Bun.file("node_modules/material/dist/styles.css").text();
const bundle = await Bun.build({
  files: {
    "stepper-label-width.ts": `
      import "material/elements/css/ripple";
      import { registerStyles } from "material/elements";
      import { defineStepper } from "./src/elements/stepper";
      registerStyles({ stepper: ${JSON.stringify(css)} });
      defineStepper();
    `,
  },
  entrypoints: ["stepper-label-width.ts"],
  target: "browser",
  format: "iife",
});
assert(bundle.success, bundle.logs.map(String).join("\n"));
const js = await bundle.outputs[0].text();

const steps = `
  <m-step value="store" label="Store">Store panel</m-step>
  <m-step value="pickup" label="Pickup time">Pickup panel</m-step>
  <m-step value="payment" label="Payment">Payment panel</m-step>`;
const fixture = [408, 500, 528].flatMap(width => ["end", "bottom"].map(placement => `
  <section data-width="${width}" data-placement="${placement}" style="width:${width}px;overflow-wrap:anywhere">
    <m-stepper orientation="horizontal" value="store" label-placement="${placement}">${steps}</m-stepper>
  </section>`)).join("");

const failures: string[] = [];
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch(engine === chromium ? { args: ["--use-mock-keychain", "--password-store=basic"] } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 780 }, colorScheme: "light" });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setContent(`<!doctype html><html lang="en" data-theme="baseline"><head><meta charset="utf-8"></head><body>${fixture}</body></html>`);
    await page.addStyleTag({ content: peer });
    await page.addScriptTag({ content: js });
    await page.waitForFunction(() => [...document.querySelectorAll("m-stepper")].every(host => host.shadowRoot?.querySelectorAll(".mtrl-stepper__header").length === 3));
    const cases = await page.evaluate(async () => {
      await document.fonts.ready;
      for (let frame = 0; frame < 4; frame++) await new Promise(requestAnimationFrame);
      return [...document.querySelectorAll<HTMLElement>("section")].map(section => {
        const root = section.firstElementChild!.shadowRoot!.querySelector<HTMLElement>(".mtrl-stepper")!;
        const list = root.querySelector<HTMLElement>(".mtrl-stepper__list")!;
        const headers = [...list.querySelectorAll<HTMLElement>(".mtrl-stepper__header")];
        const labels = headers.map(header => {
          const label = header.querySelector<HTMLElement>(".mtrl-stepper__label")!;
          const hidden = getComputedStyle(label.parentElement!).clipPath !== "none";
          const probe = label.cloneNode(true) as HTMLElement;
          probe.style.cssText = "position:absolute;visibility:hidden;inline-size:min-content;max-inline-size:none;white-space:normal;overflow-wrap:normal;word-break:normal";
          label.after(probe);
          const widestWord = probe.getBoundingClientRect().width;
          probe.style.inlineSize = "max-content";
          const maxContent = probe.getBoundingClientRect().width;
          probe.remove();
          const text = label.firstChild!;
          const range = document.createRange();
          const lineTops = new Set<number>();
          const brokenWords: string[] = [];
          if (!hidden) {
            for (const word of (text.textContent ?? "").matchAll(/\S+/g)) {
              range.setStart(text, word.index!);
              range.setEnd(text, word.index! + word[0].length);
              const wordTops = new Set([...range.getClientRects()].map(rect => rect.top));
              if (wordTops.size > 1) brokenWords.push(word[0]);
              for (const top of wordTops) lineTops.add(top);
            }
          }
          return {
            text: text.textContent,
            header: header.getBoundingClientRect().width,
            width: label.getBoundingClientRect().width,
            widestWord,
            maxContent,
            lines: lineTops.size,
            brokenWords,
            hidden,
            wrap: getComputedStyle(label).overflowWrap,
            wordBreak: getComputedStyle(label).wordBreak,
          };
        });
        const rails = [...list.querySelectorAll<HTMLElement>(".mtrl-stepper__connector")]
          .filter(rail => getComputedStyle(rail).display !== "none")
          .map(rail => rail.getBoundingClientRect().width);
        return {
          width: Number(section.dataset.width), placement: section.dataset.placement,
          compact: root.classList.contains("mtrl-stepper--compact-labels"),
          overflow: list.scrollWidth > list.clientWidth + 1, labels, rails,
        };
      });
    });
    for (const result of cases) {
      const id = `${engine.name()} ${result.width}px ${result.placement}`;
      const expectedCompact = result.width === 408 && result.placement === "end";
      const check = (condition: boolean, message: string) => { if (!condition) failures.push(`${id}: ${message}`); };
      console.log(`${id} ${JSON.stringify(result)}`);
      check(result.compact === expectedCompact, `expected compact=${expectedCompact}, got ${result.compact}`);
      check(!result.overflow, "list exceeds its host");
      check(result.rails.length === 2 && result.rails.every(width => width >= (expectedCompact ? 8 : 32)), "connectors retain their minimum width");
      if (!expectedCompact) check(result.rails.some(width => width > 32.5), "connectors consume spare width");
      for (const label of result.labels) {
        check(label.wrap === "normal" && label.wordBreak === "normal", `${label.text} inherits a wrapping rule`);
        if (expectedCompact) check(label.hidden === (label.text !== "Store"), `${label.text} has the wrong compact visibility`);
        if (!label.hidden) {
          check(label.header + 0.5 >= label.widestWord, `${label.text} has a header narrower than its widest word`);
          check(label.width + 0.5 >= label.widestWord, `${label.text} is narrower than its widest word`);
          check(label.brokenWords.length === 0, `${label.text} breaks inside ${label.brokenWords.join(", ")}`);
        }
        if (!expectedCompact) {
          check(!label.hidden && label.lines === 1, `${label.text} should fit on one line`);
          check(label.width + 0.5 >= label.maxContent, `${label.text} is narrower than its max-content width`);
        }
      }
    }
    // A direct override still needs a compact fallback even when the letters
    // wrap inside the allocated box without growing its scroll width.
    const forcedBreak = await page.evaluate(async () => {
      const section = document.querySelector<HTMLElement>('section[data-width="528"][data-placement="end"]')!;
      const root = section.firstElementChild!.shadowRoot!.querySelector(".mtrl-stepper")!;
      const pickup = root.querySelectorAll<HTMLElement>(".mtrl-stepper__label")[1];
      pickup.style.inlineSize = "20px";
      pickup.style.overflowWrap = "anywhere";
      section.style.width = "500px";
      for (let frame = 0; frame < 4; frame++) await new Promise(requestAnimationFrame);
      return root.classList.contains("mtrl-stepper--compact-labels");
    });
    if (!forcedBreak) failures.push(`${engine.name()}: a direct wrapping override bypasses compact mode`);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}
assert.deepEqual(failures, []);
console.log("Stepper labels fit their headers in Chromium and WebKit.");
