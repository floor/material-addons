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

    // The image fallback: a failed image (error event, or naturalWidth 0
    // once the browser gave up) hides the broken picture; whatever other
    // content was authored — an icon beside it — keeps showing, and when
    // nothing readable remains the initials take the shape instead.
    const failedImages = new Set<HTMLImageElement>();

    function imageFailed(img: HTMLImageElement): void {
      if (failedImages.has(img)) return;
      failedImages.add(img);
      img.classList.add(`${AVATAR_CLASSES.ROOT}__img--failed`);
      img.setAttribute("aria-hidden", "true");
      syncFallback();
    }

    function imageRecovered(img: HTMLImageElement): void {
      if (!failedImages.delete(img)) return;
      img.classList.remove(`${AVATAR_CLASSES.ROOT}__img--failed`);
      img.removeAttribute("aria-hidden");
      syncFallback();
    }

    /** Every image failed, and nothing else in the content is showing. */
    function contentIsBlank(): boolean {
      const nodes = slot?.assignedElements({ flatten: true }) ?? Array.from(content.children);
      const others = nodes.flatMap(node =>
        node.localName === "img" ? [] : (node.textContent?.trim() || node.localName === "svg" || node.children.length > 0) && node.localName !== "slot" ? [node] : []);
      const liveImages = images().filter((img) => !failedImages.has(img));
      return others.length === 0 && liveImages.length === 0;
    }

    /** The initials the fallback shows: the text, or the label's first letters. */
    function fallbackInitials(): string {
      const source = settings.text || (settings.label ?? "");
      return Array.from(source).slice(0, 2).join("");
    }

    function syncFallback(): void {
      if (settings.variant !== "image") return;
      const blank = contentIsBlank();
      const initials = fallbackInitials();
      const fallen = blank;
      root.classList.toggle(`${AVATAR_CLASSES.ROOT}--image-fallback`, fallen);
      // The content node stays mounted — hidden by the class — so a later
      // valid src still fires load on a node under the root, and the alt
      // keeps feeding the accessible name. The initials render beside it
      // when there are any.
      text.textContent = initials;
      if (fallen && initials && text.parentElement !== shape) shape.append(text);
      else if ((!fallen || !initials) && text.parentElement === shape) text.remove();
      // The name the root carries depends on the fallback state.
      updateName();
    }

    /** An image element, without an instanceof that a jsdom page cannot name. */
    const isImage = (node: EventTarget | null): node is HTMLImageElement =>
      !!node && (node as Element).localName === "img";

    /** Browsers fire error without bubbling; the root hears it in capture. */
    function imageError(event: Event): void {
      if (isImage(event.target)) imageFailed(event.target);
    }

    function checkImagesLoaded(): void {
      for (const img of images()) {
        if (failedImages.has(img)) {
          if (img.complete && img.naturalWidth > 0) imageRecovered(img);
        } else if (img.complete && img.naturalWidth === 0 && (img.getAttribute("src") ?? "") !== "") {
          imageFailed(img);
        }
      }
      syncFallback();
    }

    function updateName() {
      const pictures = settings.variant === "image" ? images() : [];
      const first = pictures[0];
      const imageLabel = first && (first.getAttribute("alt") || hiddenImages.get(first));
      // On the initials fallback the image is hidden, so its own alt cannot
      // name anything: the root takes the name — the alt when there is one,
      // else the initials.
      const fallen = root.classList.contains(`${AVATAR_CLASSES.ROOT}--image-fallback`);
      const fallbackName = fallen ? (imageLabel || fallbackInitials()) : undefined;
      const name = settings.ariaLabel ?? (settings.label || (settings.variant === "text" ? settings.text : imageLabel) || fallbackName) ?? "";
      const description = settings.supportingText;
      const announcement = badge.name();
      const namedRoot = root.localName !== "div" || settings.variant !== "image" ||
        settings.ariaLabel !== undefined || !!settings.label || !!description || !!announcement || !!fallbackName;

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
      imageObserver.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ["alt", "src"] });
      for (const node of slot?.assignedElements({ flatten: true }) ?? []) {
        imageObserver.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ["alt", "src"] });
      }
      checkImagesLoaded();
      updateName();
      syncFallback();
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
        unbindRootListeners();
        root.replaceWith(replacement);
        root = replacement;
        bindRootListeners();
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
      if (settings.variant !== "image") root.classList.remove(`${AVATAR_CLASSES.ROOT}--image-fallback`);
      updateName();
      syncFallback();
    }

    function renderText() {
      text.textContent = Array.from(settings.text).slice(0, 2).join("");
      updateName();
    }

    function placeBadge() {
      badge.place(settings.placement);
      updateName();
    }

    // error does not bubble and load fires per resource; both are heard in
    // capture on the CURRENT root, because setInteractive replaces the root
    // node and rebinds them along with click.
    function imageLoad(event: Event): void {
      if (isImage(event.target)) checkImagesLoaded();
    }

    function bindRootListeners(): void {
      root.addEventListener("click", click);
      root.addEventListener("error", imageError, true);
      root.addEventListener("load", imageLoad, true);
    }

    function unbindRootListeners(): void {
      root.removeEventListener("click", click);
      root.removeEventListener("error", imageError, true);
      root.removeEventListener("load", imageLoad, true);
    }

    bindRootListeners();
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
        unbindRootListeners();
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
