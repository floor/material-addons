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
    Object.defineProperty(img, "complete", { value: true });
    Object.defineProperty(img, "naturalWidth", { value: 0 });
    img.dispatchEvent(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(img.classList.contains("mtrl-avatar__img--failed")).toBe(true);
    const shape = avatar.element.querySelector(".mtrl-avatar__shape")!;
    expect(shape.querySelector(".mtrl-avatar__text")?.textContent).toBe("Me");
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
    Object.defineProperty(img, "complete", { value: true });
    Object.defineProperty(img, "naturalWidth", { value: 0 });
    img.dispatchEvent(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(img.classList.contains("mtrl-avatar__img--failed")).toBe(true);
    expect(avatar.element.querySelector("svg")).toBeTruthy();
    avatar.destroy();
  });
});
