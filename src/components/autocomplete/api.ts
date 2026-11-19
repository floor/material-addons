import type { AutocompleteComponent, AutocompleteConfig, AutocompleteEvents } from "./types";

export function createListeners<T>(config: AutocompleteConfig<T>) {
  type EventName = keyof AutocompleteEvents<T>;
  type Listener = (detail: never) => void;
  const listeners = new Map<EventName, Set<Listener>>();
  const on: AutocompleteComponent<T>["on"] = function (this: AutocompleteComponent<T>, event, handler) {
    let handlers = listeners.get(event);
    if (!handlers) listeners.set(event, handlers = new Set());
    handlers.add(handler);
    return this;
  };
  const off: AutocompleteComponent<T>["off"] = function (this: AutocompleteComponent<T>, event, handler) {
    listeners.get(event)?.delete(handler);
    return this;
  };
  const callbacks = {
    input: config.onInput, select: config.onSelect, change: config.onChange,
    open: config.onOpen, close: config.onClose, clear: config.onClear,
  };
  const emit = <K extends EventName>(event: K, detail: Parameters<AutocompleteEvents<T>[K]>[0]) => {
    const handlers: (Listener | undefined)[] = [
      callbacks[event], config.on?.[event], ...listeners.get(event) ?? [],
    ];
    for (const handler of new Set(handlers)) handler?.(detail as never);
  };
  return { on, off, emit, clear: () => listeners.clear() };
}
