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
  cacheDir: "node_modules/.vite-avatar",
  optimizeDeps: { entries: ["test/browser/avatar.html"], exclude: ["material-addons/svelte", "svelte"] },
  server: { host: "127.0.0.1", port: 0, hmr: false },
  plugins: [{
    name: "compile-svelte-fixture",
    transform(source, filename) {
      if (filename.endsWith(".svelte")) return compile(source, { filename, generate: "client" }).js;
    },
  }],
});

let browser;
try {
  await server.listen();
  const { port } = server.httpServer.address();
  const fixture = `http://127.0.0.1:${port}/test/browser/avatar.html`;
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(fixture);
  const factory = page.getByRole("button", { name: "Account, 8", exact: true });
  await factory.waitFor();
  assert.equal(await factory.getAttribute("aria-describedby"), await factory.locator(".mtrl-avatar__supporting").getAttribute("id"));
  assert.equal((await factory.boundingBox()).width >= 48, true);
  assert.equal((await factory.boundingBox()).height, 48);
  assert.equal((await factory.locator(".mtrl-avatar__shape").boundingBox()).width, 24);

  const badge = factory.locator(".mtrl-avatar__badge");
  const shape = factory.locator(".mtrl-avatar__shape");
  assert.equal((await badge.boundingBox()).x > (await shape.boundingBox()).x, true);
  await page.evaluate(() => { document.documentElement.dir = "rtl"; });
  assert.equal((await badge.boundingBox()).x, (await shape.boundingBox()).x);
  const shapeText = factory.locator(".mtrl-avatar__text");
  for (const [background, foreground] of [["rgb(250, 220, 250)", "rgb(40, 20, 40)"], ["rgb(50, 30, 50)", "rgb(250, 200, 250)"]]) {
    await page.evaluate(([background, foreground]) => {
      document.documentElement.style.setProperty("--mtrl-sys-color-primary-container", background);
      document.documentElement.style.setProperty("--mtrl-sys-color-on-primary-container", foreground);
    }, [background, foreground]);
    assert.deepEqual(await shapeText.evaluate(node => {
      const style = getComputedStyle(node);
      return [style.backgroundColor, style.color];
    }), [background, foreground]);
  }

  const image = page.locator("#image img");
  assert.equal(await image.getAttribute("alt"), "");
  assert.equal((await image.boundingBox()).width, 30);
  assert.equal(await image.evaluate(node => getComputedStyle(node).objectFit), "cover");
  assert.equal(await page.locator("#image").getByRole("group", { name: "Portrait" }).count(), 1);
  assert.equal(await page.getByRole("img", { name: "Alternate portrait" }).count(), 0);

  const icon = page.getByRole("img", { name: "Account icon" });
  const iconShape = await icon.locator(".mtrl-avatar__shape").boundingBox();
  const glyph = await page.locator("#icon svg").boundingBox();
  assert.equal(glyph.width, 18);
  assert.equal(glyph.height, 18);
  assert.equal(glyph.x - iconShape.x, 3);
  assert.equal(glyph.y - iconShape.y, 3);

  const link = page.getByRole("link", { name: "Profile" });
  assert.equal(await link.getAttribute("aria-disabled"), "true");
  assert.equal(await link.getAttribute("tabindex"), "-1");
  await link.evaluate(node => node.click());
  assert.equal(new URL(page.url()).hash, "");
  await page.locator("#link").evaluate(node => { node.disabled = false; });
  await link.focus();
  await page.keyboard.press("Enter");
  assert.equal(new URL(page.url()).hash, "#destination");

  await page.emulateMedia({ forcedColors: "active" });
  await page.keyboard.press("Shift+Tab");
  assert.equal(await factory.evaluate(node => node.matches(":focus-visible")), true);
  const reference = page.locator("#forced-reference");
  assert.equal(await shape.evaluate(node => getComputedStyle(node).borderTopWidth), "1px");
  assert.equal(await shape.evaluate(node => getComputedStyle(node).borderTopColor),
    await reference.evaluate(node => getComputedStyle(node).borderTopColor));
  assert.equal(await factory.evaluate(node => getComputedStyle(node).outlineColor),
    await reference.evaluate(node => getComputedStyle(node).outlineColor));
  await page.locator("#link").evaluate(node => { node.disabled = true; });
  assert.equal(await link.locator(".mtrl-avatar__text").evaluate(node => getComputedStyle(node).color),
    await reference.evaluate(node => getComputedStyle(node).color));
  assert.deepEqual(errors, []);
  await page.close();

  for (const framework of ["react", "vue", "solid", "svelte"]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${fixture}?framework=${framework}`);
    const button = page.getByRole("button", { name: "Account", exact: true });
    await button.waitFor();
    assert.equal(await button.getAttribute("type"), "button", framework);
    assert.equal(await button.getByText("Editor").count(), 1, framework);
    assert.equal((await button.locator(".mtrl-avatar__shape").boundingBox()).width, 24, framework);
    assert.equal((await button.boundingBox()).height, 48, framework);
    await page.keyboard.press("Tab");
    assert.equal(await button.evaluate(node => node.matches(":focus-visible")), true, framework);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    assert.deepEqual(await page.evaluate(() => window.avatarClicks), [["click", true], ["click", true]], framework);
    await page.getByRole("button", { name: "Disable avatar" }).click();
    assert.equal(await button.isDisabled(), true, framework);
    await button.evaluate(node => node.click());
    assert.equal(await page.evaluate(() => window.avatarClicks.length), 2, framework);
    assert.equal(await page.getByRole("img", { name: "Presentational avatar" }).count(), 1, framework);
    assert.deepEqual(errors, [], framework);
    await page.close();
    console.log(`${framework}: avatar attributes, styles, native activation and disabled state passed`);
  }
  // The image fallback: a broken src hides the picture, the initials take
  // the shape, and the avatar's box never moves.
  {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/test/browser/avatar.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!window.createAvatar && !!window.defineAvatar);
    const fallback = await page.evaluate(async () => {
      document.body.innerHTML = "";
      const below = document.createElement("p");
      below.textContent = "after";
      const avatar = window.createAvatar({
        variant: "image",
        text: "Ada Lovelace",
        content: '<img src="/definitely-missing.png" alt="Ada">',
      });
      document.body.append(avatar.element, below);
      const box = avatar.element.getBoundingClientRect();
      const before = { width: box.width, height: box.height, below: below.getBoundingClientRect().top };
      const img = avatar.element.querySelector("img");
      await new Promise((resolve) => setTimeout(resolve, 300));
      const after = avatar.element.getBoundingClientRect();
      // The initials taking the shape detach the content node; the img node
      // itself still carries the failed mark.
      return {
        before,
        after: { width: after.width, height: after.height, below: below.getBoundingClientRect().top },
        failedClass: img?.classList.contains("mtrl-avatar__img--failed") ?? false,
        initials: avatar.element.querySelector(".mtrl-avatar__shape .mtrl-avatar__text")?.textContent ?? null,
        role: avatar.element.getAttribute("role"),
        name: avatar.element.getAttribute("aria-label"),
        imgDisplayed: img ? img.isConnected && getComputedStyle(img).display !== "none" : false,
      };
    });
    assert.equal(fallback.failedClass, true, `the broken image is marked failed (got ${fallback.failedClass})`);
    assert.equal(fallback.initials, "Ad", `the initials take the shape (got ${fallback.initials})`);
    assert.equal(fallback.role, "img", `a non-interactive fallback is role img (got ${fallback.role})`);
    assert.equal(fallback.name, "Ada", `role img carries the alt name (got ${fallback.name})`);
    assert.equal(fallback.imgDisplayed, false, "the broken image is not displayed");
    assert.equal(fallback.after.width, fallback.before.width, `no layout shift in width (got ${fallback.before.width} -> ${fallback.after.width})`);
    assert.equal(fallback.after.height, fallback.before.height, `no layout shift in height (got ${fallback.before.height} -> ${fallback.after.height})`);
    assert.equal(fallback.after.below, fallback.before.below, `the page below does not move (got ${fallback.before.below} -> ${fallback.after.below})`);
    assert.deepEqual(errors, [], "fallback: no page errors");
    await page.close();
    console.log("Avatar image fallback: broken src hidden, initials shown, no layout shift");

  // An interactive avatar keeps its button and its name across the fallback.
  {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/test/browser/avatar.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!window.createAvatar && !!window.defineAvatar);
    const interactive = await page.evaluate(async () => {
      document.body.innerHTML = "";
      const avatar = window.createAvatar({
        variant: "image",
        text: "Ada Lovelace",
        label: "Ada",
        onClick: () => {},
        content: '<img src="/definitely-missing.png" alt="Ada">',
      });
      document.body.appendChild(avatar.element);
      await new Promise((resolve) => setTimeout(resolve, 300));
      return {
        tag: avatar.element.localName,
        role: avatar.element.getAttribute("role"),
        name: avatar.element.getAttribute("aria-label"),
        fallback: avatar.element.classList.contains("mtrl-avatar--image-fallback"),
      };
    });
    assert.equal(interactive.tag, "button", `the interactive avatar stays a button (got ${interactive.tag})`);
    assert.equal(interactive.role, null, `no role override on a button (got ${interactive.role})`);
    assert.equal(interactive.name, "Ada", `the button keeps its name (got ${interactive.name})`);
    assert.equal(interactive.fallback, true, "the fallback engages on the interactive avatar too");
    assert.deepEqual(errors, [], "interactive: no page errors");
    await page.close();
    console.log("Avatar interactive fallback: button kept, name kept");
  }

  // Recovery: the same img's src changes to a valid URL; the picture
  // returns and the initials leave.
  {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/test/browser/avatar.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!window.createAvatar && !!window.defineAvatar);
    const recovery = await page.evaluate(async () => {
      document.body.innerHTML = "";
      const avatar = window.createAvatar({
        variant: "image",
        text: "Ada Lovelace",
        content: '<img src="/definitely-missing.png" alt="Ada">',
      });
      document.body.appendChild(avatar.element);
      const img = avatar.element.querySelector("img");
      await new Promise((resolve) => setTimeout(resolve, 250));
      const fallen = avatar.element.classList.contains("mtrl-avatar--image-fallback");
      const initialsShown = !!avatar.element.querySelector(".mtrl-avatar__shape .mtrl-avatar__text");
      img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'%3E%3Ccircle cx='20' cy='20' r='16' fill='%236750a4'/%3E%3C/svg%3E";
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        fallen,
        initialsShown,
        recovered: !img.classList.contains("mtrl-avatar__img--failed") && !avatar.element.classList.contains("mtrl-avatar--image-fallback"),
        imgDisplayed: img.isConnected && getComputedStyle(img).display !== "none" && img.naturalWidth > 0,
        initialsGone: !avatar.element.querySelector(".mtrl-avatar__shape .mtrl-avatar__text"),
        imgAltKept: img.getAttribute("alt"),
      };
    });
    assert.equal(recovery.fallen, true, "the fallback engaged first");
    assert.equal(recovery.initialsShown, true, "the initials were showing");
    assert.equal(recovery.recovered, true, `a valid src on the same img recovers the picture (got ${JSON.stringify(recovery.recovered)})`);
    assert.equal(recovery.imgDisplayed, true, "the recovered image is displayed");
    assert.equal(recovery.initialsGone, true, "the initials leave the shape on recovery");
    assert.equal(recovery.imgAltKept, "Ada", `the alt survives the whole cycle (got ${recovery.imgAltKept})`);
    assert.deepEqual(errors, [], "recovery: no page errors");
    await page.close();
    console.log("Avatar fallback recovery: valid src restores the picture, initials leave, name kept");
  }

  // The element: a slotted image that fails shows the initials, and a
  // slotted image that loads shows the picture (labelled or not).
  {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/test/browser/avatar.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!window.createAvatar && !!window.defineAvatar);
    const element = await page.evaluate(async () => {
      window.defineAvatar();
      document.body.innerHTML = "";
      const host = document.createElement("m-avatar");
      host.setAttribute("variant", "image");
      host.setAttribute("text", "AL");
      const broken = document.createElement("img");
      broken.src = "/definitely-missing.png";
      broken.alt = "Ada photograph";
      broken.slot = "";
      host.appendChild(broken);
      document.body.appendChild(host);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const inner = host.shadowRoot?.querySelector(".mtrl-avatar") ?? null;
      const fallenState = {
        fallbackClass: inner?.classList.contains("mtrl-avatar--image-fallback") ?? false,
        initials: inner?.querySelector(".mtrl-avatar__shape .mtrl-avatar__text")?.textContent ?? null,
        name: inner?.getAttribute("aria-label") ?? host.getAttribute("aria-label") ?? null,
      };
      broken.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'%3E%3Ccircle cx='20' cy='20' r='16' fill='%236750a4'/%3E%3C/svg%3E";
      await new Promise((resolve) => setTimeout(resolve, 400));
      const recoveredState = {
        fallbackClass: inner?.classList.contains("mtrl-avatar--image-fallback") ?? true,
        initialsGone: !inner?.querySelector(".mtrl-avatar__shape .mtrl-avatar__text"),
        loaded: broken.naturalWidth > 0,
      };
      return { fallenState, recoveredState };
    });
    assert.equal(element.fallenState.fallbackClass, true, `element: the slotted broken image engages the fallback (got ${element.fallenState.fallbackClass})`);
    assert.equal(element.fallenState.initials, "AL", `element: the initials show (got ${element.fallenState.initials})`);
    assert.notEqual(element.fallenState.name, null, "element: the name survives on the fallback");
    assert.equal(element.recoveredState.fallbackClass, false, `element: a valid src on the slotted image recovers (got ${element.recoveredState.fallbackClass})`);
    assert.equal(element.recoveredState.initialsGone, true, "element: the initials leave on recovery");
    assert.equal(element.recoveredState.loaded, true, "element: the slotted image really loaded");
    assert.deepEqual(errors, [], "element: no page errors");
    await page.close();
    console.log("Avatar element fallback: slotted broken image falls back and recovers");

  // The icon path: a failed img beside an authored icon hides (no clipping),
  // the icon shows, and the root takes role img with the alt name.
  {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/test/browser/avatar.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!window.createAvatar && !!window.defineAvatar);
    const iconPath = await page.evaluate(async () => {
      document.body.innerHTML = "";
      const host = document.createElement("m-avatar");
      host.setAttribute("variant", "icon");
      const img = document.createElement("img");
      img.src = "/definitely-missing.png";
      img.alt = "Account photo";
      host.appendChild(img);
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.innerHTML = '<circle cx="12" cy="12" r="10"></circle>';
      host.appendChild(icon);
      document.body.appendChild(host);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const inner = host.shadowRoot?.querySelector(".mtrl-avatar") ?? null;
      return {
        failedClass: img.classList.contains("mtrl-avatar__img--failed"),
        imgDisplay: getComputedStyle(img).display,
        iconVisible: !!(inner && icon.isConnected && getComputedStyle(icon).display !== "none"),
        role: inner?.getAttribute("role") ?? null,
        name: inner?.getAttribute("aria-label") ?? null,
      };
    });
    assert.equal(iconPath.failedClass, true, `icon path: the failed img is marked (got ${iconPath.failedClass})`);
    assert.equal(iconPath.imgDisplay, "none", `icon path: the failed img is display none, no clipping (got ${iconPath.imgDisplay})`);
    assert.equal(iconPath.iconVisible, true, "icon path: the authored icon shows");
    assert.equal(iconPath.role, "img", `icon path: the root takes role img (got ${iconPath.role})`);
    assert.equal(iconPath.name, "Account photo", `icon path: the alt names the root (got ${iconPath.name})`);
    assert.deepEqual(errors, [], "icon path: no page errors");
    await page.close();
    console.log("Avatar icon path: failed img hidden, icon shows, root named role img");

  // An author's inline display (priority included) survives failure and
  // recovery; a still-hidden one is restored at destroy.
  {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/test/browser/avatar.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!window.createAvatar && !!window.defineAvatar);
    const display = await page.evaluate(async () => {
      document.body.innerHTML = "";
      const avatar = window.createAvatar({
        variant: "image",
        text: "Ada Lovelace",
        content: '<img src="/definitely-missing.png" alt="Ada">',
      });
      document.body.appendChild(avatar.element);
      const img = avatar.element.querySelector("img");
      img.style.setProperty("display", "inline-block", "important");
      await new Promise((resolve) => setTimeout(resolve, 300));
      const failedDisplay = img.style.display;
      const failedPriority = img.style.getPropertyPriority("display");
      const failedComputed = getComputedStyle(img).display;
      img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'%3E%3Ccircle cx='20' cy='20' r='16' fill='%236750a4'/%3E%3C/svg%3E";
      await new Promise((resolve) => setTimeout(resolve, 400));
      const recoveredDisplay = img.style.display;
      const recoveredPriority = img.style.getPropertyPriority("display");
      return { failedDisplay, failedPriority, failedComputed, recoveredDisplay, recoveredPriority };
    });
    assert.equal(display.failedComputed, "none", `the failure hides the img in the computed style (got ${display.failedComputed})`);
    assert.equal(display.failedDisplay, "none", "the failure's inline none is in place");
    assert.equal(display.recoveredDisplay, "inline-block", `recovery restores the author's value (got ${display.recoveredDisplay})`);
    assert.equal(display.recoveredPriority, "important", `recovery restores the author's priority (got ${display.recoveredPriority})`);
    assert.deepEqual(errors, [], "display: no page errors");
    await page.close();
    console.log("Avatar display save/restore: inline-block !important survives the whole cycle");
  }

  // variant=image with a decorative icon: the failed img's alt still names
  // the root.
  {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/test/browser/avatar.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!window.createAvatar && !!window.defineAvatar);
    const decorative = await page.evaluate(async () => {
      document.body.innerHTML = "";
      const avatar = window.createAvatar({
        variant: "image",
        content: '<img src="/definitely-missing.png" alt="Portrait of Ada"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle></svg>',
      });
      document.body.appendChild(avatar.element);
      await new Promise((resolve) => setTimeout(resolve, 300));
      return {
        role: avatar.element.getAttribute("role"),
        name: avatar.element.getAttribute("aria-label"),
        iconVisible: !!avatar.element.querySelector("svg"),
        imgHidden: getComputedStyle(avatar.element.querySelector("img")).display === "none",
      };
    });
    assert.equal(decorative.imgHidden, true, "the failed img is hidden");
    assert.equal(decorative.iconVisible, true, "the decorative icon shows");
    assert.equal(decorative.role, "img", `the root takes role img (got ${decorative.role})`);
    assert.equal(decorative.name, "Portrait of Ada", `the failed img's alt names the root (got ${decorative.name})`);
    assert.deepEqual(errors, [], "decorative: no page errors");
    await page.close();
    console.log("Avatar decorative icon: failed img hidden, icon shows, root named from the alt");

  // Never a nameless role img: with alt="" and initials AL the root is
  // role img NAMED "AL"; with no alt and no initials it is not role img.
  {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/test/browser/avatar.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!window.createAvatar && !!window.defineAvatar);
    const nameless = await page.evaluate(async () => {
      const make = (content) => window.createAvatar({ variant: "image", text: "AL", content });
      document.body.innerHTML = "";
      const emptyAlt = make('<img src="/definitely-missing.png" alt="">');
      document.body.appendChild(emptyAlt.element);
      const noAlt = make('<img src="/definitely-missing.png">');
      document.body.appendChild(noAlt.element);
      const noInitials = window.createAvatar({ variant: "image", content: '<img src="/definitely-missing.png">' });
      document.body.appendChild(noInitials.element);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const read = (avatar) => ({
        role: avatar.element.getAttribute("role"),
        name: avatar.element.getAttribute("aria-label"),
        initials: avatar.element.querySelector(".mtrl-avatar__shape .mtrl-avatar__text")?.textContent ?? null,
      });
      return { emptyAlt: read(emptyAlt), noAlt: read(noAlt), noInitials: read(noInitials) };
    });
    assert.equal(nameless.emptyAlt.role, "img", `alt="": role img (got ${nameless.emptyAlt.role})`);
    assert.equal(nameless.emptyAlt.name, "AL", `alt="": named from the initials (got ${nameless.emptyAlt.name})`);
    assert.equal(nameless.emptyAlt.initials, "AL", `alt empty: the initials are showing (got ${JSON.stringify(nameless.emptyAlt.initials)})`);
    assert.equal(nameless.noAlt.role, "img", `no alt: role img (got ${nameless.noAlt.role})`);
    assert.equal(nameless.noAlt.name, "AL", `no alt: named from the initials (got ${nameless.noAlt.name})`);
    assert.notEqual(nameless.noInitials.role, "img", `no alt and no initials: no nameless role img (got ${nameless.noInitials.role})`);
    assert.deepEqual(errors, [], "nameless: no page errors");
    await page.close();
    console.log('Avatar nameless guard: alt="" and no alt name the root "AL"; nothing becomes a nameless img');
  }
  }
  }
  }
  }

  console.log("Avatar crop, names, badge direction, colors, and link behavior passed");
} finally {
  await browser?.close();
  await server.close();
}
