import { expect, test } from "bun:test";
import "material/elements/css/ripple";
import "material/elements/css/badge";
import { registerStyles } from "material/elements";
import { avatarElement, defineAvatar } from "../../src/elements/avatar";
import { installDom } from "../utils/dom";

installDom();

test("client avatar reflects attributes, preserves slotted markup and uses a button for direct listeners", async () => {
  registerStyles({ avatar: ".mtrl-avatar{display:inline-flex}" });
  expect(avatarElement.spec.ssr).toBe(false);
  defineAvatar();
  document.body.innerHTML = '<m-avatar size="medium"><img alt="Ada"></m-avatar>';
  const host = document.querySelector("m-avatar")!;
  const image = host.querySelector("img")!;
  const root = () => host.shadowRoot!.querySelector(".mtrl-avatar")!;
  await Promise.resolve();
  expect(root().localName).toBe("div");
  expect(root().getAttribute("part")).toBe("avatar");
  expect(root().classList.contains("mtrl-avatar--medium")).toBe(true);
  expect(host.shadowRoot!.querySelector("slot")!.assignedElements()).toEqual([image]);
  expect(image.alt).toBe("Ada");
  expect(host.hasAttribute("avatar")).toBe(false);

  host.variant = "text";
  host.size = "medium";
  host.text = "AL";
  host.supportingText = "Editor";
  host.placement = "bottom-end";
  host.disabled = true;
  expect(host.getAttribute("supporting-text")).toBe("Editor");
  expect(host.getAttribute("placement")).toBe("bottom-end");
  expect(host.hasAttribute("disabled")).toBe(true);
  expect(root().classList.contains("mtrl-avatar--medium")).toBe(true);
  expect(root().querySelector(".mtrl-avatar__text")?.textContent).toBe("AL");
  expect(root().querySelector("slot")).toBeNull();

  let clicks = 0;
  const controller = new window.AbortController();
  host.addEventListener("click", () => { clicks++; }, { signal: controller.signal });
  expect(root().localName).toBe("button");
  (root() as HTMLButtonElement).click();
  expect(clicks).toBe(0);
  host.disabled = false;
  (root() as HTMLButtonElement).click();
  expect(clicks).toBe(1);
  controller.abort();
  expect(root().localName).toBe("div");

  host.addEventListener("click", () => { clicks++; }, { once: true });
  (root() as HTMLButtonElement).click();
  expect(clicks).toBe(2);
  expect(root().localName).toBe("div");
  host.remove();
});
