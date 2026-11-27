import { describe, expect, test } from "bun:test";
import { createAvatar } from "../../src/components/avatar";
import { installDom } from "../utils/dom";

describe("createAvatar", () => {
  installDom();

  test("uses the default geometry and falls back for unknown options", () => {
    const avatar = createAvatar({ variant: "unknown", size: "unknown", shape: "unknown", className: "owner" });
    const root = avatar.element;
    expect(root.localName).toBe("div");
    expect(root.classList.contains("owner")).toBe(true);
    expect([avatar.getVariant(), avatar.getSize(), avatar.getShape(), avatar.getPlacement()]).toEqual(["image", "large", "round", "top-end"]);
    expect(avatar.isDisabled()).toBe(false);
    expect(root.querySelector(".mtrl-avatar__meta, .mtrl-avatar__badge")).toBeNull();
    avatar.setSize("small").setSize("absent").setShape("square").setShape("absent");
    expect(root.classList.contains("mtrl-avatar--large")).toBe(true);
    expect(root.classList.contains("mtrl-avatar--round")).toBe(true);
    avatar.destroy();
  });

  test("renders Unicode monograms and keeps one full name and one description", () => {
    const avatar = createAvatar({ variant: "text", text: "🧑🏽Ada", content: '<img alt="Other">' });
    const root = avatar.element;
    expect(root.querySelector(".mtrl-avatar__text")?.textContent).toBe("🧑🏽");
    expect(root.querySelector("img")).toBeNull();
    expect(root.getAttribute("role")).toBe("img");
    expect(root.getAttribute("aria-label")).toBe("🧑🏽Ada");
    avatar.setLabel("Ada").setSupportingText("Editor");
    expect(root.getAttribute("aria-label")).toBe("Ada");
    expect(root.querySelector("#" + root.getAttribute("aria-describedby"))?.textContent).toBe("Editor");
    avatar.setLabel(undefined).setSupportingText(undefined);
    expect(root.querySelector(".mtrl-avatar__meta")).toBeNull();
    expect(root.hasAttribute("aria-describedby")).toBe(false);
    avatar.destroy();
  });

  test("uses authored image alt until the avatar supplies a name", () => {
    const image = document.createElement("img");
    image.alt = "Ada";
    const avatar = createAvatar({ content: image });
    const root = avatar.element;
    expect(root.getAttribute("role")).toBeNull();
    expect(image.alt).toBe("Ada");
    avatar.setLabel("Ada Lovelace").setBadge({ variant: "large", label: 103, max: 99 });
    expect(image.alt).toBe("");
    expect(root.getAttribute("aria-label")).toBe("Ada Lovelace, 99+");
    const badge = root.querySelector<HTMLElement>(".mtrl-avatar__badge");
    expect(badge?.getAttribute("aria-hidden")).toBe("true");
    avatar.setPlacement("top-start");
    expect(badge?.dataset.placement).toBe("top-start");
    avatar.setPlacement("none");
    expect(badge?.parentElement).toBe(root);
    avatar.setBadge(undefined).setLabel(undefined);
    expect(image.alt).toBe("Ada");
    expect(root.querySelector(".mtrl-avatar__badge")).toBeNull();
    avatar.destroy();
  });

  test("keeps icon markup decorative and gates native activation", () => {
    let clicks = 0;
    const avatar = createAvatar({
      variant: "icon", ariaLabel: "Account", content: "<svg></svg>", disabled: true,
      onClick: () => { clicks++; },
    });
    const button = avatar.element as HTMLButtonElement;
    expect(button.localName).toBe("button");
    expect(button.type).toBe("button");
    expect(button.disabled).toBe(true);
    expect(button.querySelector(".mtrl-avatar__content")?.getAttribute("aria-hidden")).toBe("true");
    button.click();
    expect(clicks).toBe(0);
    avatar.setDisabled(false);
    button.click();
    expect(clicks).toBe(1);

    const link = createAvatar({ href: "#account", target: "_blank", rel: "noopener", disabled: true, onClick: () => { clicks++; } });
    expect(link.element.localName).toBe("a");
    expect(link.element.getAttribute("aria-disabled")).toBe("true");
    expect(link.element.tabIndex).toBe(-1);
    expect(link.element.hasAttribute("href")).toBe(false);
    expect(link.element.dispatchEvent(new window.MouseEvent("click", { cancelable: true }))).toBe(false);
    expect(clicks).toBe(1);
    link.setDisabled(false);
    expect(link.element.getAttribute("href")).toBe("#account");
    expect(link.element.getAttribute("target")).toBe("_blank");
    expect(link.element.getAttribute("rel")).toBe("noopener");
    link.destroy();
    avatar.destroy();
  });
});
