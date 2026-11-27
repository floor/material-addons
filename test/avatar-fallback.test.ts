// Unit: the image fallback swaps the broken picture for the initials.
import { describe, expect, test } from "bun:test";
import { installDom } from "./utils/dom";

describe("avatar image fallback", () => {
  installDom();

  test("a broken image hides and the initials take the shape", async () => {
    const { createAvatar } = await import("../src/components/avatar");
    const avatar = createAvatar({
      variant: "image",
      text: "Melvin Marx",
      content: '<img src="http://localhost/missing.png" alt="Melvin Marx">',
    });
    document.body.appendChild(avatar.element);
    const img = avatar.element.querySelector("img")!;
    // jsdom does not load images: complete with naturalWidth 0 after src set.
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 0, configurable: true });
    img.dispatchEvent(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(img.classList.contains("mtrl-avatar__img--failed")).toBe(true);
    const shape = avatar.element.querySelector(".mtrl-avatar__shape")!;
    expect(shape.querySelector(".mtrl-avatar__text")?.textContent).toBe("Me");
    avatar.destroy();
  });

  test("a failed image recovers when its src loads", async () => {
    const { createAvatar } = await import("../src/components/avatar");
    const avatar = createAvatar({
      variant: "image",
      text: "Ada Lovelace",
      content: '<img src="http://localhost/missing.png" alt="Ada">',
    });
    document.body.appendChild(avatar.element);
    const img = avatar.element.querySelector("img")!;
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 0, configurable: true });
    img.dispatchEvent(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(avatar.element.classList.contains("mtrl-avatar--image-fallback")).toBe(true);
    // The same element now loads: content returns, initials leave the shape.
    Object.defineProperty(img, "naturalWidth", { value: 80, configurable: true });
    img.setAttribute("src", "http://localhost/ada.png");
    img.dispatchEvent(new Event("load"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(img.classList.contains("mtrl-avatar__img--failed")).toBe(false);
    expect(avatar.element.classList.contains("mtrl-avatar--image-fallback")).toBe(false);
    expect(avatar.element.querySelector(".mtrl-avatar__shape .mtrl-avatar__text")).toBeNull();
    avatar.destroy();
  });

  test("the alt-only accessible name survives the fallback", async () => {
    const { createAvatar } = await import("../src/components/avatar");
    const avatar = createAvatar({
      variant: "image",
      content: '<img src="http://localhost/missing.png" alt="Ada photograph">',
    });
    document.body.appendChild(avatar.element);
    const img = avatar.element.querySelector("img")!;
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 0, configurable: true });
    img.dispatchEvent(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(avatar.element.getAttribute("role")).toBe("img");
    expect(avatar.element.getAttribute("aria-label")).toBe("Ada photograph");
    avatar.destroy();
  });

  test("the icon path: failed img hidden, icon shows, root takes role img and the alt name", async () => {
    const { createAvatar } = await import("../src/components/avatar");
    const avatar = createAvatar({
      variant: "icon",
      content: '<img src="http://localhost/missing.png" alt="Account photo"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg>',
    });
    document.body.appendChild(avatar.element);
    const img = avatar.element.querySelector("img")!;
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 0, configurable: true });
    img.dispatchEvent(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(img.classList.contains("mtrl-avatar__img--failed")).toBe(true);
    expect(avatar.element.querySelector("svg")).toBeTruthy();
    expect(avatar.element.getAttribute("role")).toBe("img");
    expect(avatar.element.getAttribute("aria-label")).toBe("Account photo");
    avatar.destroy();
  });

  test("an author's inline display survives failure and recovery, priority included", async () => {
    const { createAvatar } = await import("../src/components/avatar");
    const avatar = createAvatar({
      variant: "image",
      text: "Ada Lovelace",
      content: '<img src="http://localhost/missing.png" alt="Ada">',
    });
    document.body.appendChild(avatar.element);
    const img = avatar.element.querySelector("img")!;
    img.style.setProperty("display", "inline-block", "important");
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 0, configurable: true });
    img.dispatchEvent(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(img.style.display).toBe("none");
    expect(img.style.getPropertyPriority("display")).toBe("important");
    // Recovery restores the author's exact declaration.
    Object.defineProperty(img, "naturalWidth", { value: 80, configurable: true });
    img.setAttribute("src", "http://localhost/ada.png");
    img.dispatchEvent(new Event("load"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(img.style.display).toBe("inline-block");
    expect(img.style.getPropertyPriority("display")).toBe("important");
    avatar.destroy();
  });

  test("destroy restores a still-hidden author display", async () => {
    const { createAvatar } = await import("../src/components/avatar");
    const avatar = createAvatar({
      variant: "image",
      text: "Ada",
      content: '<img src="http://localhost/missing.png" alt="Ada">',
    });
    document.body.appendChild(avatar.element);
    const img = avatar.element.querySelector("img")!;
    img.style.display = "block";
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 0, configurable: true });
    img.dispatchEvent(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(img.style.display).toBe("none");
    avatar.destroy();
    expect(img.style.display).toBe("block");
    expect(img.classList.contains("mtrl-avatar__img--failed")).toBe(false);
  });

  test("variant=image with a decorative icon: the failed img's alt names the root", async () => {
    const { createAvatar } = await import("../src/components/avatar");
    const avatar = createAvatar({
      variant: "image",
      content: '<img src="http://localhost/missing.png" alt="Portrait of Ada"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle></svg>',
    });
    document.body.appendChild(avatar.element);
    const img = avatar.element.querySelector("img")!;
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 0, configurable: true });
    img.dispatchEvent(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The icon keeps the shape (content not blank), yet the failed img
    // carried the only name: the root takes role img with that alt.
    expect(img.classList.contains("mtrl-avatar__img--failed")).toBe(true);
    expect(avatar.element.querySelector("svg")).toBeTruthy();
    expect(avatar.element.getAttribute("role")).toBe("img");
    expect(avatar.element.getAttribute("aria-label")).toBe("Portrait of Ada");
    avatar.destroy();
  });

  test("alt empty with initials: role img named from the initials, never nameless", async () => {
    const { createAvatar } = await import("../src/components/avatar");
    const avatar = createAvatar({
      variant: "image",
      text: "AL",
      content: '<img src="http://localhost/missing.png" alt="">',
    });
    document.body.appendChild(avatar.element);
    const img = avatar.element.querySelector("img")!;
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 0, configurable: true });
    img.dispatchEvent(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(avatar.element.getAttribute("role")).toBe("img");
    expect(avatar.element.getAttribute("aria-label")).toBe("AL");
    avatar.destroy();
  });

  test("no alt at all with initials: the root is named from the initials", async () => {
    const { createAvatar } = await import("../src/components/avatar");
    const avatar = createAvatar({
      variant: "image",
      text: "AL",
      content: '<img src="http://localhost/missing.png">',
    });
    document.body.appendChild(avatar.element);
    const img = avatar.element.querySelector("img")!;
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 0, configurable: true });
    img.dispatchEvent(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(avatar.element.getAttribute("role")).toBe("img");
    expect(avatar.element.getAttribute("aria-label")).toBe("AL");
    avatar.destroy();
  });

  test("no alt and no initials: no nameless role img", async () => {
    const { createAvatar } = await import("../src/components/avatar");
    const avatar = createAvatar({
      variant: "image",
      content: '<img src="http://localhost/missing.png">',
    });
    document.body.appendChild(avatar.element);
    const img = avatar.element.querySelector("img")!;
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 0, configurable: true });
    img.dispatchEvent(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Nothing names the root, so it does not become a nameless img.
    expect(avatar.element.getAttribute("role")).not.toBe("img");
    avatar.destroy();
  });

  test("a whitespace-only alt falls through to the initials", async () => {
    const { createAvatar } = await import("../src/components/avatar");
    const avatar = createAvatar({
      variant: "image",
      text: "AL",
      content: '<img src="http://localhost/missing.png" alt="   ">',
    });
    document.body.appendChild(avatar.element);
    const img = avatar.element.querySelector("img")!;
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 0, configurable: true });
    img.dispatchEvent(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(img.getAttribute("aria-hidden")).toBe("true");
    expect(avatar.element.getAttribute("role")).toBe("img");
    expect(avatar.element.getAttribute("aria-label")).toBe("AL");
    avatar.destroy();
  });

  test("the icon variant with no name source is not a nameless img", async () => {
    const { createAvatar } = await import("../src/components/avatar");
    const avatar = createAvatar({
      variant: "icon",
      content: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle></svg>',
    });
    document.body.appendChild(avatar.element);
    expect(avatar.element.getAttribute("role")).not.toBe("img");
    expect(avatar.element.getAttribute("aria-label")).toBe(null);
    avatar.destroy();
  });

  test("an authored icon beside the failed image keeps showing", async () => {
    const { createAvatar } = await import("../src/components/avatar");
    const avatar = createAvatar({
      variant: "image",
      text: "Ada",
      content: '<img src="http://localhost/missing.png" alt="Ada"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12"></circle></svg>',
    });
    document.body.appendChild(avatar.element);
    const img = avatar.element.querySelector("img")!;
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 0, configurable: true });
    img.dispatchEvent(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(img.classList.contains("mtrl-avatar__img--failed")).toBe(true);
    expect(avatar.element.querySelector("svg")).toBeTruthy();
    avatar.destroy();
  });
});
