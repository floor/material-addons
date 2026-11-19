import { hideFromTopLayer, setHTML, showInTopLayer } from "material/core/dom";
import { AUTOCOMPLETE_CLASSES as classes } from "../constants";
import type { BaseConfig, Option } from "../config";
import type { AutocompletePlacement } from "../types";

const optionClass = "mtrl-listbox__option";
const activeClass = "mtrl-listbox__option--active";
let nextId = 0;

function node(className: string, text?: string, tag = "div") {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function withListbox<T>(
  config: BaseConfig<T>, field: HTMLElement, input: HTMLInputElement, signal: AbortSignal,
  commit: (option: Option<T>, event: Event) => void, dismiss: (event?: Event) => void,
) {
  const listbox = node(`mtrl-listbox ${classes.LISTBOX}`);
  const id = `mtrl-autocomplete-${++nextId}`;
  listbox.id = id;
  listbox.hidden = true;
  listbox.setAttribute("role", "listbox");
  listbox.setAttribute("popover", "manual");
  if (config.ariaLabel || config.label) listbox.setAttribute("aria-label", config.ariaLabel || config.label!);
  let rows: HTMLElement[] = [];
  let options: Option<T>[] = [];
  let active = -1;
  let placement = config.placement;
  let opened: AbortController | undefined;

  const highlight = (index: number, scroll = false) => {
    rows[active]?.classList.remove(activeClass);
    active = options[index] && !options[index].disabled ? index : -1;
    if (active === -1 || !opened) {
      input.removeAttribute("aria-activedescendant");
    } else {
      const row = rows[active];
      row.classList.add(activeClass);
      input.setAttribute("aria-activedescendant", row.id);
      if (scroll) {
        const bounds = listbox.getBoundingClientRect();
        const option = row.getBoundingClientRect();
        // Scrolling the row into view can also scroll the page or a clipped
        // ancestor, which would dismiss the top-layer popup.
        listbox.scrollTop += option.top < bounds.top ? option.top - bounds.top : Math.max(0, option.bottom - bounds.bottom);
      }
    }
  };

  const place = () => {
    if (!opened) return;
    const win = input.ownerDocument.defaultView!;
    const viewport = win.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const right = left + (viewport?.width ?? win.innerWidth);
    const bottom = top + (viewport?.height ?? win.innerHeight);
    const anchor = field.getBoundingClientRect();
    const rtl = win.getComputedStyle(field).direction === "rtl";
    listbox.dir = rtl ? "rtl" : "ltr";
    const width = Math.min(anchor.width, right - left);
    const x = placement.endsWith("end") !== rtl ? anchor.right - width : anchor.left;
    const above = Math.max(0, anchor.top - top);
    const below = Math.max(0, bottom - anchor.bottom);
    listbox.style.maxHeight = config.maxHeight
      ? `min(${config.maxHeight}, ${Math.max(above, below)}px)`
      : "";
    let upwards = placement.startsWith("top");
    const height = listbox.getBoundingClientRect().height;
    if (height > (upwards ? above : below) && (upwards ? below > above : above > below)) upwards = !upwards;
    Object.assign(listbox.style, {
      width: `${width}px`, left: `${Math.max(left, Math.min(x, right - width))}px`,
      maxHeight: `min(var(--mtrl-autocomplete-max-height, ${config.maxHeight}), ${upwards ? above : below}px)`,
      top: upwards ? "auto" : `${Math.max(top, anchor.bottom)}px`,
      bottom: upwards ? `${Math.max(0, win.innerHeight - anchor.top)}px` : "auto",
    });
  };

  const show = (root: HTMLElement) => {
    if (opened) return place();
    opened = new AbortController();
    const scope = { signal: opened.signal };
    const doc = input.ownerDocument;
    const win = doc.defaultView!;
    listbox.hidden = false;
    showInTopLayer(listbox, { kind: "popover-manual" });
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-controls", id);
    const outside = (event: Event) => {
      const path = event.composedPath();
      if (!path.includes(root) && !path.includes(listbox)) dismiss(event);
    };
    doc.addEventListener("pointerdown", outside, { ...scope, capture: true });
    // Dialog close does not bubble. Listen on each tree that contains the host.
    let tree: Node = root.getRootNode();
    const closeDialog = (event: Event) => {
      let host: Node = root;
      while (host) {
        if ((event.target as Node).contains(host)) return dismiss(event);
        const owner = host.getRootNode() as ShadowRoot;
        if (!owner.host) break;
        host = owner.host;
      }
    };
    while (tree) {
      tree.addEventListener("close", closeDialog, { ...scope, capture: true });
      const host = (tree as ShadowRoot).host;
      if (!host) break;
      tree = host.getRootNode();
    }
    win.addEventListener("resize", dismiss, scope);
    win.addEventListener("scroll", event => {
      const path = event.composedPath();
      if (!path.includes(listbox) && !path.includes(root)) dismiss(event);
    }, { ...scope, capture: true });
    win.visualViewport?.addEventListener("scroll", dismiss, scope);
    win.visualViewport?.addEventListener("resize", dismiss, scope);
    const observer = new MutationObserver(() => { if (!input.isConnected) dismiss(); });
    observer.observe(doc, { childList: true, subtree: true });
    if (root.getRootNode() !== doc) observer.observe(root.getRootNode(), { childList: true, subtree: true });
    opened.signal.addEventListener("abort", () => observer.disconnect(), { once: true });
    highlight(active);
    place();
  };

  const hide = () => {
    if (!opened) return;
    opened.abort();
    opened = undefined;
    highlight(-1);
    hideFromTopLayer(listbox);
    listbox.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-controls");
  };

  const render = (items: Option<T>[], query: string, value: string | null, message?: string) => {
    active = -1;
    options = items;
    rows = items.map((item, index) => {
      const row = node(optionClass);
      row.id = `${id}-${index}`;
      row.dataset.index = String(index);
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(item.value === value));
      if (item.disabled) row.setAttribute("aria-disabled", "true");
      if (item.icon != null) {
        const icon = node(classes.OPTION_ICON);
        icon.setAttribute("aria-hidden", "true");
        setHTML(icon, item.icon);
        row.append(icon);
      }
      const text = node(classes.OPTION_TEXT);
      const at = query && config.highlightMatch ? item.text.toLowerCase().indexOf(query.toLowerCase()) : -1;
      if (at < 0) text.textContent = item.text;
      else text.append(item.text.slice(0, at), node(classes.MATCH, item.text.slice(at, at + query.length), "mark"), item.text.slice(at + query.length));
      const content = node(classes.OPTION_CONTENT);
      content.append(text);
      if (item.supportingText) content.append(node(classes.OPTION_SUPPORTING_TEXT, item.supportingText));
      row.append(content);
      return row;
    });
    listbox.replaceChildren(...(message && !rows.length ? [node(classes.EMPTY, message)] : rows));
    highlight(config.autoHighlight ? items.findIndex(item => !item.disabled) : -1);
    place();
  };

  const rowAt = (event: Event) => Number((event.target as Element).closest?.(`.${optionClass}`)?.getAttribute("data-index") ?? -1);
  const choose = (index: number, event: Event) => {
    const item = options[index];
    if (opened && item && !item.disabled) commit(item, event);
  };
  let press: PointerEvent | undefined;
  listbox.addEventListener("pointerdown", event => {
    if (rowAt(event) < 0 || event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    press = event;
  }, { signal });
  listbox.addEventListener("pointermove", event => {
    if (event.pointerType === "mouse") highlight(rowAt(event));
  }, { signal });
  listbox.addEventListener("pointercancel", () => { press = undefined; }, { signal });
  listbox.addEventListener("pointerup", event => {
    const index = rowAt(event);
    if (press?.pointerId === event.pointerId && event.pointerType !== "mouse" && index === rowAt(press) &&
      Math.hypot(event.clientX - press.clientX, event.clientY - press.clientY) < 10) choose(index, event);
    press = undefined;
  }, { signal });
  listbox.addEventListener("click", event => {
    // Touch and pen select on pointerup. Synthetic/AT clicks still work.
    if (!("pointerType" in event) || !event.pointerType || event.pointerType === "mouse") choose(rowAt(event), event);
  }, { signal });

  return {
    listbox, show, hide, highlight, render,
    isOpen: () => !!opened,
    active: () => options[active],
    move(delta: number, value?: string | null) {
      const enabled = options.flatMap((option, index) => option.disabled ? [] : [index]);
      const selected = enabled.find(index => options[index].value === value);
      const previous = enabled.indexOf(active);
      const index = Math.max(0, Math.min(enabled.length - 1, (previous < 0 && delta < 0 ? enabled.length : previous) + delta));
      highlight(selected ?? enabled[index] ?? -1, true);
    },
    place,
    getPlacement: () => placement,
    setPlacement(value: AutocompletePlacement) { placement = value; place(); },
  };
}
