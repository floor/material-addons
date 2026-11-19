import { createBaseConfig, normalize, snapshot, type Option } from "./config";
import { AUTOCOMPLETE_CLASSES as classes } from "./constants";
import { createListeners } from "./api";
import { withTextField } from "./features/withTextField";
import { withListbox } from "./features/withListbox";
import type { AutocompleteComponent, AutocompleteConfig, AutocompleteDensity } from "./types";

/** A Material text field with an editable, active-descendant listbox. */
export function createAutocomplete<T = unknown>(options: AutocompleteConfig<T> = {}): AutocompleteComponent<T> {
  const config = createBaseConfig(options);
  const lifetime = new AbortController();
  const scope = { signal: lifetime.signal };
  const listeners = createListeners(config);
  const { textField, element, field, input, status, canClear, sync } = withTextField(config);
  const popup = withListbox(config, field, input, lifetime.signal, choose, close);
  const { listbox } = popup;
  element.append(listbox);
  let available = normalize(config.options ?? []);
  let value: string | null = null;
  let selected: Option<T> | undefined;
  let request: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let internalFocus = false;

  const eligible = () => input.value.length >= config.minLength;
  const interactive = () => !lifetime.signal.aborted && !input.disabled && !input.readOnly;
  const detail = (originalEvent: Event | null) => ({ component, originalEvent });
  const inputDetail = (event: Event) => ({ ...detail(event), value: input.value, isEmpty: !input.value });

  function write(model: string | null, option?: Option<T>) {
    value = model;
    selected = option;
    textField.setValue(option?.text ?? model ?? "");
    sync(value);
  }

  function loading(active: boolean) {
    element.classList.toggle(classes.LOADING, active);
    if (active) input.setAttribute("aria-busy", "true");
    else input.removeAttribute("aria-busy");
  }

  function cancel() {
    clearTimeout(timer);
    if (request) {
      request.abort();
      request = undefined;
      loading(false);
      status.textContent = "";
    }
  }

  function close(event: Event | null = null) {
    cancel();
    if (!popup.isOpen()) return;
    popup.hide();
    element.classList.remove(classes.OPEN);
    listeners.emit("close", detail(event));
  }

  function show(event: Event | null) {
    if (popup.isOpen() || !input.isConnected) return;
    popup.show(element);
    element.classList.add(classes.OPEN);
    listeners.emit("open", detail(event));
  }

  function draw(query: string, event: Event | null = null, open = false, pending = false) {
    const q = query.trim().toLowerCase();
    const items = pending ? [] : available.filter(option =>
      config.filter === false || (config.filter
        ? config.filter(snapshot(option), query)
        : !q || option.text.toLowerCase().includes(q) || option.supportingText?.toLowerCase().includes(q)));
    const message = pending ? config.loadingText : config.emptyText;
    popup.render(items, query.trim(), value, message);
    status.textContent = pending ? config.loadingText : items.length
      ? `${items.length} option${items.length === 1 ? "" : "s"} available` : "No options available";
    if (!items.length && !message) {
      if (!pending) close(event);
    } else if (open && interactive()) show(event);
    return items.map(snapshot);
  }

  function refresh(event: Event | null, immediate = false, navigate?: false | -1 | 1) {
    cancel();
    if (!interactive() || !eligible()) {
      close(event);
      popup.render([], "", value);
      status.textContent = "";
      return;
    }
    const query = input.value;
    const source = config.source;
    const present = () => {
      draw(query, event, true);
      if (navigate === undefined) return;
      popup.highlight(-1);
      if (navigate) popup.move(navigate, value);
    };
    const run = () => {
      if (!source) {
        present();
        return;
      }
      const controller = new AbortController();
      request = controller;
      loading(true);
      draw(query, event, true, true);
      void (async () => {
        let items;
        try {
          items = await source(query, controller.signal);
        } catch {
          // A failed request must not reopen stale suggestions.
        }
        if (controller.signal.aborted) return;
        request = undefined;
        loading(false);
        if (!items) {
          status.textContent = "";
          close(event);
          return;
        }
        available = normalize(items);
        present();
      })();
    };
    if ((!immediate || source) && config.debounce > 0) timer = setTimeout(run, config.debounce);
    else run();
  }

  function changed(previousValue: string | null, event: Event, option = selected, force = false) {
    if (force || previousValue !== value) {
      listeners.emit("change", {
        ...detail(event), value, previousValue, text: input.value, option: option ? snapshot(option) : null,
      });
    }
  }

  function choose(option: Option<T>, event: Event) {
    const previous = value;
    write(option.value, option);
    close(event);
    listeners.emit("select", { ...detail(event), value: option.value, text: option.text, option: snapshot(option) });
    changed(previous, event, option, true);
  }

  function commitText(event: Event) {
    const previous = value;
    const text = input.value;
    const match = text === selected?.text ? selected : available.find(option => !option.disabled && option.text === text);
    if (match) write(match.value, match);
    else if (config.strict) write(value, selected);
    else write(text || null);
    changed(previous, event);
  }

  function clearFrom(event: Event, reopen = true) {
    const previous = value;
    write(null);
    listeners.emit("clear", inputDetail(event));
    listeners.emit("input", inputDetail(event));
    changed(previous, event, undefined, true);
    if (reopen) refresh(event, true);
  }

  const component: AutocompleteComponent<T> = {
    element, textField, listbox,
    getValue: () => value,
    setValue(next) {
      cancel();
      const option = available.find(item => !item.disabled && item.value === next);
      write(option?.value ?? (config.strict ? null : next ?? null), option);
      if (popup.isOpen()) draw(input.value);
      return this;
    },
    getText: () => input.value,
    getSelectedOption: () => selected ? snapshot(selected) : null,
    getOptions: () => available.map(snapshot),
    setOptions(items) {
      cancel();
      available = normalize(items);
      const next = selected && available.find(item => !item.disabled && item.value === value);
      if (next && input.value === selected?.text && next.text !== input.value) write(next.value, next);
      else if (next) selected = next;
      if (popup.isOpen()) draw(input.value);
      return this;
    },
    filter(query = input.value) { return draw(query); },
    clear() { cancel(); write(null); if (popup.isOpen()) draw(""); return this; },
    open() { refresh(null, true); return this; },
    close() { close(); return this; },
    toggle() { return popup.isOpen() ? this.close() : this.open(); },
    isOpen: popup.isOpen,
    setVariant(next) { textField.setVariant(next); popup.place(); return this; },
    getVariant: textField.getVariant,
    setDensity(next) {
      textField.setDensity(next);
      listbox.classList.toggle(classes.COMPACT, next === "compact");
      popup.place();
      return this;
    },
    getDensity: () => textField.getDensity() as AutocompleteDensity,
    getPlacement: popup.getPlacement,
    setPlacement(next) { popup.setPlacement(next); return this; },
    setSupportingText(text, error) { textField.setSupportingText(text, error); return this; },
    removeSupportingText() { textField.removeSupportingText(); return this; },
    setError(error, text) { textField.setError(error, text); return this; },
    isError: textField.isError,
    enable() { textField.enable(); sync(value); return this; },
    disable() { close(); textField.disable(); sync(value); return this; },
    isDisabled: textField.isDisabled,
    on: listeners.on,
    off: listeners.off,
    destroy() {
      if (lifetime.signal.aborted) return;
      lifetime.abort();
      cancel();
      popup.hide();
      element.classList.remove(classes.OPEN);
      listeners.clear();
      listbox.remove();
      textField.destroy();
    },
  };

  input.addEventListener("input", event => {
    if (!interactive()) return;
    sync(value);
    listeners.emit("input", inputDetail(event));
    if (!(event as InputEvent).isComposing) refresh(event);
  }, scope);
  input.addEventListener("focus", event => {
    if (config.openOnFocus && !internalFocus) refresh(event, true);
  }, scope);
  element.addEventListener("focusout", event => {
    if (element.contains(event.relatedTarget as Node | null)) return;
    if (!interactive()) return;
    commitText(event);
    close(event);
  }, scope);
  element.addEventListener("pointerdown", event => {
    if (textField.trailingIcon?.contains(event.target as Node) && input === (input.getRootNode() as Document | ShadowRoot).activeElement) {
      event.preventDefault();
    }
  }, scope);
  textField.on("trailing", ({ event }) => {
    if (!interactive()) return;
    internalFocus = true;
    input.focus();
    internalFocus = false;
    if (canClear()) clearFrom(event);
    else if (popup.isOpen()) close(event);
    else refresh(event, true);
  });

  input.addEventListener("keydown", event => {
    if (!interactive() || event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey) return;
    const { key, altKey } = event;
    const open = popup.isOpen();
    const active = popup.active();
    if (altKey) {
      if (key === "ArrowDown" && !open) {
        event.preventDefault();
        refresh(event, true, false);
      } else if (key === "ArrowUp" && open) {
        event.preventDefault();
        if (active) choose(active, event);
        else close(event);
      }
    } else if (key === "ArrowDown" || key === "ArrowUp" || (open && (key === "PageDown" || key === "PageUp"))) {
      event.preventDefault();
      const direction = key.endsWith("Down") ? 1 : -1;
      if (open) popup.move(direction * (key.startsWith("Page") ? 10 : 1));
      else refresh(event, true, direction);
    } else if (key === "Enter" && open) {
      if (active) { event.preventDefault(); choose(active, event); }
      else if (!config.strict) { commitText(event); close(event); }
    } else if (key === "Escape") {
      if (open) { event.preventDefault(); close(event); }
      else if (canClear()) { event.preventDefault(); clearFrom(event, false); }
    } else if (open && key === "Tab") {
      if (active) choose(active, event);
      else close(event);
    } else if (open && ["Home", "End", "ArrowLeft", "ArrowRight"].includes(key)) popup.highlight(-1);
  }, scope);

  component.setValue(config.value);
  listbox.classList.toggle(classes.COMPACT, config.density === "compact");
  return component;
}
