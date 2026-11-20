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
  cacheDir: "node_modules/.vite-rating",
  optimizeDeps: { entries: ["test/browser/rating.html"], exclude: ["material-addons/svelte", "svelte"] },
  server: { host: "127.0.0.1", port: 0, hmr: false },
  plugins: [{
    name: "compile-svelte-fixture",
    transform(source, filename) {
      if (filename.endsWith(".svelte")) return compile(source, { filename, generate: "client" }).js;
    },
  }],
});

const star = (page, id, index) => page.locator(`#${id} .mtrl-rating__star`).nth(index - 1);

async function clickRatio(page, id, index, ratio) {
  const box = await star(page, id, index).boundingBox();
  assert.ok(box, `${id} star ${index}`);
  await page.mouse.click(box.x + box.width * ratio, box.y + box.height / 2);
}

let browser;
try {
  await server.listen();
  const { port } = server.httpServer.address();
  const fixture = `http://127.0.0.1:${port}/test/browser/rating.html`;
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(fixture);
  await page.locator("#medium").waitFor();

  assert.equal(await star(page, "small", 1).evaluate(node => getComputedStyle(node).width), "18px");
  assert.equal(await star(page, "medium", 1).evaluate(node => getComputedStyle(node).width), "24px");
  assert.equal(await star(page, "large", 1).evaluate(node => getComputedStyle(node).width), "32px");
  assert.equal(await star(page, "medium", 1).evaluate(node => getComputedStyle(node, "::after").width), "48px");
  assert.equal(await star(page, "medium", 1).evaluate(node => getComputedStyle(node, "::after").height), "48px");

  const halfFill = () => page.locator("#half .mtrl-rating__star--half .mtrl-rating__star-fill");
  assert.match(await halfFill().evaluate(node => getComputedStyle(node).clipPath), /^inset\(0px 50% 0px 0px\)$/);
  for (const [background, foreground] of [["rgb(10, 20, 30)", "rgb(240, 230, 220)"], ["rgb(240, 230, 220)", "rgb(10, 20, 30)"]]) {
    await page.evaluate(([color]) => {
      document.documentElement.style.colorScheme = color === "rgb(10, 20, 30)" ? "light" : "dark";
      document.documentElement.style.setProperty("--mtrl-sys-color-primary", color);
    }, [background, foreground]);
    assert.equal(await page.locator("#medium .mtrl-rating__star--full .mtrl-rating__star-fill").first().evaluate(node => getComputedStyle(node).color), background);
  }

  await clickRatio(page, "hit", 4, 0.25);
  assert.equal(await page.evaluate(() => window.hit.getValue()), 3.5);
  await clickRatio(page, "hit", 4, 0.75);
  assert.equal(await page.evaluate(() => window.hit.getValue()), 4);
  await page.evaluate(() => { document.documentElement.dir = "rtl"; window.hit.setValue(0); });
  assert.match(await halfFill().evaluate(node => getComputedStyle(node).clipPath), /^inset\(0px 0px 0px 50%\)$/);
  await clickRatio(page, "hit", 4, 0.25);
  assert.equal(await page.evaluate(() => window.hit.getValue()), 4);
  await clickRatio(page, "hit", 4, 0.75);
  assert.equal(await page.evaluate(() => window.hit.getValue()), 3.5);

  await page.evaluate(() => { document.documentElement.dir = "ltr"; });
  await page.emulateMedia({ forcedColors: "active" });
  const reference = page.locator("#forced-reference");
  const paint = (selector, prop) => page.locator(selector).first().evaluate((node, name) => getComputedStyle(node)[name], prop);
  assert.equal(await paint("#medium .mtrl-rating__star--full .mtrl-rating__star-fill", "color"), await paint("#forced-reference", "outlineColor"));
  assert.equal(await paint("#medium .mtrl-rating__star--empty .mtrl-rating__star-empty", "color"), await reference.evaluate(node => getComputedStyle(node).borderTopColor));
  assert.equal(await paint("#disabled .mtrl-rating__star-fill", "color"), await reference.evaluate(node => getComputedStyle(node).color));
  await page.keyboard.press("Tab");
  assert.equal(await page.locator("#small .mtrl-rating__stop").first().evaluate(node => node.matches(":focus-visible")), true);
  assert.equal(await page.locator("#small .mtrl-rating__stop").first().evaluate(node => getComputedStyle(node).outlineColor), await paint("#forced-reference", "outlineColor"));
  assert.deepEqual(errors, []);
  await page.close();

  for (const framework of ["react", "vue", "solid", "svelte"]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${fixture}?framework=${framework}`);
    const group = page.getByRole("radiogroup", { name: "Quality" });
    await group.waitFor();
    const box = await group.locator(".mtrl-rating__star").nth(1).boundingBox();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
    const target = await group.locator(".mtrl-rating__star").nth(3).boundingBox();
    await page.mouse.click(target.x + target.width * 0.25, target.y + target.height / 2);
    assert.equal((await page.locator("#bound").innerText()).trim(), "3.5", framework);
    await page.getByRole("radio", { name: "3.5 stars" }).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal((await page.locator("#bound").innerText()).trim(), "4", framework);
    await page.keyboard.press("ArrowLeft");
    assert.equal((await page.locator("#bound").innerText()).trim(), "3.5", framework);
    const log = await page.evaluate(() => window.ratingLog);
    assert.equal(log.some(entry => entry[0] === "change" && entry[1] === 3.5), true, framework);
    assert.equal(log.some(entry => entry[0] === "hover" && typeof entry[1] === "number"), true, framework);
    await page.getByRole("button", { name: "Set two" }).click();
    assert.equal((await page.locator("#bound").innerText()).trim(), "2", framework);
    assert.equal(await page.getByRole("radio", { name: "2 stars" }).getAttribute("aria-checked"), "true", framework);
    assert.deepEqual(errors, [], framework);
    await page.close();
    console.log(`${framework}: rating half steps, keyboard, and value binding passed`);
  }
  console.log("Rating sizes, half-star geometry, and forced colors passed");
} finally {
  await browser?.close();
  await server.close();
}
