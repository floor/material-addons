import { setHTML } from "material/core/dom";
import { withDisabled, type ElementComponent } from "material/core/compose";
import { AVATAR_CLASSES } from "../constants";
import type { AvatarSettings } from "../config";
import { withBadge } from "./withBadge";

let nextId = 0;

function span(document: Document, className: string) {
  const element = document.createElement("span");
  element.className = className;
  return element;
}

function setAttribute(element: Element, name: string, value: string | undefined) {
  if (value == null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

export function withRenderer(settings: AvatarSettings) {
  return (component: ElementComponent) => {
    let root = component.element;
    const document = root.ownerDocument;
    const shape = span(document, AVATAR_CLASSES.SHAPE);
    const content = span(document, AVATAR_CLASSES.CONTENT);
    const text = span(document, AVATAR_CLASSES.TEXT);
    const meta = span(document, AVATAR_CLASSES.META);
    const label = span(document, AVATAR_CLASSES.LABEL);
    const supporting = span(document, AVATAR_CLASSES.SUPPORTING);
    supporting.id = `mtrl-avatar-supporting-${++nextId}`;
    for (const node of [text, label, supporting]) node.setAttribute("aria-hidden", "true");
    root.append(shape);

    const badge = withBadge(shape);
    const disabled = withDisabled(settings)({ ...component, get element() { return root; } }).disabled;
    const hiddenImages = new Map<HTMLImageElement, string | null>();
    let slot: HTMLSlotElement | undefined;

    function click(event: MouseEvent) {
      if (settings.disabled) {
        event.preventDefault();
        event.stopImmediatePropagation();
      } else {
        settings.onClick?.(event);
      }
    }

    function restoreImage(img: HTMLImageElement, original: string | null) {
      // An authored update wins over the temporary empty alt.
      if (img.getAttribute("alt") === "") setAttribute(img, "alt", original ?? undefined);
      hiddenImages.delete(img);
    }

    function images() {
      const nodes = slot?.assignedElements({ flatten: true }) ?? Array.from(content.children);
      return nodes.flatMap(node => node.localName === "img" ? [node as HTMLImageElement] : Array.from(node.querySelectorAll("img")));
    }

    function updateName() {
      const pictures = settings.variant === "image" ? images() : [];
      const first = pictures[0];
      const imageLabel = first && (first.getAttribute("alt") || hiddenImages.get(first));
      const name = settings.ariaLabel ?? (settings.label || (settings.variant === "text" ? settings.text : imageLabel)) ?? "";
      const description = settings.supportingText;
      const announcement = badge.name();
      const namedRoot = root.localName !== "div" || settings.variant !== "image" ||
        settings.ariaLabel !== undefined || !!settings.label || !!description || !!announcement;

      for (const [img, original] of hiddenImages) {
        if (!namedRoot || !pictures.includes(img)) restoreImage(img, original);
      }
      if (namedRoot) for (const img of pictures) {
        const current = img.getAttribute("alt");
        if (!hiddenImages.has(img) || current !== "") hiddenImages.set(img, current);
        if (current !== "") img.alt = "";
      }

      const role = root.localName === "div" ? (namedRoot ? (first || description ? "group" : "img") : undefined)
        : root.localName === "a" && settings.disabled ? "link" : undefined;
      const fullName = [name, announcement].filter(Boolean).join(", ");
      setAttribute(root, "role", role);
      setAttribute(root, "aria-label", namedRoot && fullName ? fullName : undefined);
      setAttribute(root, "aria-describedby", description ? supporting.id : undefined);
      setAttribute(root, "aria-hidden", settings.decorative ? "true" : undefined);
      setAttribute(content, "aria-hidden", settings.variant === "icon" ? "true" : undefined);
    }

    const imageObserver = new MutationObserver(updateName);
    function observeImages() {
      imageObserver.disconnect();
      imageObserver.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ["alt"] });
      for (const node of slot?.assignedElements({ flatten: true }) ?? []) {
        imageObserver.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ["alt"] });
      }
      updateName();
    }

    function setContent(next: AvatarSettings["content"]) {
      slot?.removeEventListener("slotchange", observeImages);
      for (const [img, original] of hiddenImages) restoreImage(img, original);
      if (typeof next === "string") setHTML(content, next);
      else if (next) content.replaceChildren(next);
      else content.replaceChildren();
      slot = typeof next === "object" && next.localName === "slot" ? next as HTMLSlotElement : undefined;
      slot?.addEventListener("slotchange", observeImages);
      observeImages();
    }

    function setInteractive(value: boolean) {
      const tag = settings.href != null ? "a" : settings.onClick || value ? "button" : "div";
      if (root.localName !== tag) {
        const replacement = document.createElement(tag);
        for (const attr of Array.from(root.attributes)) replacement.setAttribute(attr.name, attr.value);
        replacement.append(...Array.from(root.childNodes));
        root.removeEventListener("click", click);
        root.replaceWith(replacement);
        root = replacement;
        root.addEventListener("click", click);
      }
      setAttribute(root, "type", tag === "button" ? "button" : undefined);
      syncDisabled();
    }

    function syncDisabled() {
      if (root.localName === "a") {
        setAttribute(root, "href", settings.disabled ? undefined : settings.href);
        setAttribute(root, "target", settings.target);
        setAttribute(root, "rel", settings.rel);
        setAttribute(root, "tabindex", settings.disabled ? "-1" : undefined);
      }
      if (settings.disabled) disabled.disable();
      else disabled.enable();
      root.classList.toggle(`${AVATAR_CLASSES.ROOT}--disabled`, settings.disabled);
      updateName();
    }

    function setModifier<T extends "variant" | "size" | "shape">(key: T, value: AvatarSettings[T]) {
      root.classList.remove(`${AVATAR_CLASSES.ROOT}--${settings[key]}`);
      settings[key] = value;
      root.classList.add(`${AVATAR_CLASSES.ROOT}--${value}`);
    }

    function renderMeta() {
      label.textContent = settings.label ?? "";
      supporting.textContent = settings.supportingText ?? "";
      meta.replaceChildren(...[settings.label ? label : null, settings.supportingText ? supporting : null].filter(node => node !== null));
      if (meta.childElementCount) root.append(meta);
      else meta.remove();
      updateName();
    }

    function renderVariant() {
      const next = settings.variant === "text" ? text : content;
      const previous = shape.firstElementChild;
      if (previous !== next) {
        if (previous === content || previous === text) previous.replaceWith(next);
        else shape.prepend(next);
      }
      updateName();
    }

    function renderText() {
      text.textContent = Array.from(settings.text).slice(0, 2).join("");
      updateName();
    }

    function placeBadge() {
      badge.place(settings.placement);
      updateName();
    }

    root.addEventListener("click", click);
    setModifier("variant", settings.variant);
    setModifier("size", settings.size);
    setModifier("shape", settings.shape);
    setContent(settings.content);
    renderText();
    renderVariant();
    renderMeta();
    badge.set(settings.badge);
    placeBadge();
    setInteractive(false);

    return {
      get element() { return root; },
      setModifier, renderMeta, renderVariant, renderText, setContent, setInteractive, updateName, placeBadge,
      setDisabled(value: boolean) { settings.disabled = value; syncDisabled(); },
      setBadge(config: AvatarSettings["badge"]) { badge.set(config); placeBadge(); },
      destroy() {
        imageObserver.disconnect();
        slot?.removeEventListener("slotchange", observeImages);
        for (const [img, original] of hiddenImages) restoreImage(img, original);
        root.removeEventListener("click", click);
        badge.destroy();
        root.remove();
        component.destroy();
      },
    };
  };
}
