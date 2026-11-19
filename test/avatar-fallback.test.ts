// Unit: the image fallback swaps the broken picture for the initials.
import { describe, expect, test } from "bun:test";
import { installAutocompleteDom } from "./utils/autocomplete-dom";

describe("avatar image fallback", () => {
  installAutocompleteDom();

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
