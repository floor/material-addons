import { AUTOCOMPLETE_DEFAULTS } from "./constants";
import type { AutocompleteConfig, AutocompleteItem, AutocompleteOption } from "./types";

export const createBaseConfig = <T>(config: AutocompleteConfig<T>) => ({
  ...AUTOCOMPLETE_DEFAULTS,
  ...config,
  debounce: config.debounce ?? (config.source ? AUTOCOMPLETE_DEFAULTS.sourceDebounce : AUTOCOMPLETE_DEFAULTS.debounce),
});

export type BaseConfig<T> = ReturnType<typeof createBaseConfig<T>>;
export type Option<T> = AutocompleteOption<T> & { value: string };

export const normalize = <T>(items: readonly AutocompleteItem<T>[]): Option<T>[] => items.map(item =>
  typeof item === "string" ? { value: item, text: item } : { ...item, value: item.value ?? item.id ?? item.text });

export const snapshot = <T>(option: Option<T>): Option<T> => ({ ...option });
