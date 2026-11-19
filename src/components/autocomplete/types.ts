import type { TextFieldComponent, TextFieldConfig, TextFieldDensity, TextFieldVariant } from "material/components/text-field";
import type { AUTOCOMPLETE_PLACEMENTS } from "./constants";

export type AutocompleteVariant = TextFieldVariant;
export type AutocompleteDensity = TextFieldDensity;
export type AutocompletePlacement = typeof AUTOCOMPLETE_PLACEMENTS[keyof typeof AUTOCOMPLETE_PLACEMENTS];

export interface AutocompleteOption<TData = unknown> {
  value?: string;
  id?: string;
  text: string;
  supportingText?: string;
  /** Icon markup processed with Material's configured HTML policy. */
  icon?: string;
  disabled?: boolean;
  data?: TData;
}
export type AutocompleteItem<TData = unknown> = AutocompleteOption<TData> | string;

export interface AutocompleteEvent<TData = unknown> {
  component: AutocompleteComponent<TData>;
  originalEvent: Event | null;
}
export interface AutocompleteInputEvent<TData = unknown> extends AutocompleteEvent<TData> {
  value: string;
  isEmpty: boolean;
}
export interface AutocompleteSelectEvent<TData = unknown> extends AutocompleteEvent<TData> {
  value: string;
  text: string;
  option: AutocompleteOption<TData>;
}
export interface AutocompleteChangeEvent<TData = unknown> extends AutocompleteEvent<TData> {
  value: string | null;
  previousValue: string | null;
  text: string;
  option: AutocompleteOption<TData> | null;
}
export interface AutocompleteEvents<TData = unknown> {
  input: (event: AutocompleteInputEvent<TData>) => void;
  select: (event: AutocompleteSelectEvent<TData>) => void;
  change: (event: AutocompleteChangeEvent<TData>) => void;
  open: (event: AutocompleteEvent<TData>) => void;
  close: (event: AutocompleteEvent<TData>) => void;
  clear: (event: AutocompleteInputEvent<TData>) => void;
}

export interface AutocompleteConfig<TData = unknown> extends Pick<TextFieldConfig,
  "label" | "placeholder" | "name" | "supportingText" | "error" | "required" | "noAsterisk" |
  "disabled" | "readonly" | "leadingIcon" | "trailingIcon" | "trailingIconLabel" |
  "prefixText" | "suffixText" | "ariaLabel" | "class" | "componentName"> {
  options?: readonly AutocompleteItem<TData>[];
  /** Async suggestions for a query. Observe the signal to cancel work. */
  source?: (query: string, signal: AbortSignal) => Promise<readonly AutocompleteItem<TData>[]>;
  filter?: ((option: AutocompleteOption<TData>, query: string) => boolean) | false;
  value?: string | null;
  variant?: AutocompleteVariant;
  density?: AutocompleteDensity;
  placement?: AutocompletePlacement;
  maxHeight?: string;
  strict?: boolean;
  autoHighlight?: boolean;
  openOnFocus?: boolean;
  clearable?: boolean;
  highlightMatch?: boolean;
  minLength?: number;
  debounce?: number;
  emptyText?: string;
  loadingText?: string;
  onInput?: AutocompleteEvents<TData>["input"];
  onSelect?: AutocompleteEvents<TData>["select"];
  onChange?: AutocompleteEvents<TData>["change"];
  onOpen?: AutocompleteEvents<TData>["open"];
  onClose?: AutocompleteEvents<TData>["close"];
  onClear?: AutocompleteEvents<TData>["clear"];
  on?: Partial<AutocompleteEvents<TData>>;
}

export interface AutocompleteComponent<TData = unknown> {
  element: HTMLElement;
  textField: TextFieldComponent;
  listbox: HTMLElement;
  getValue(): string | null;
  setValue(value: string | null | undefined): this;
  getText(): string;
  getSelectedOption(): AutocompleteOption<TData> | null;
  getOptions(): AutocompleteOption<TData>[];
  setOptions(options: readonly AutocompleteItem<TData>[]): this;
  filter(query?: string): AutocompleteOption<TData>[];
  clear(): this;
  open(): this;
  close(): this;
  toggle(): this;
  isOpen(): boolean;
  setVariant(variant: AutocompleteVariant): this;
  getVariant(): AutocompleteVariant;
  setDensity(density: AutocompleteDensity): this;
  getDensity(): AutocompleteDensity;
  setPlacement(placement: AutocompletePlacement): this;
  getPlacement(): AutocompletePlacement;
  setSupportingText(text: string, isError?: boolean): this;
  removeSupportingText(): this;
  setError(error: boolean, supportingText?: string): this;
  isError(): boolean;
  enable(): this;
  disable(): this;
  isDisabled(): boolean;
  on<K extends keyof AutocompleteEvents<TData>>(event: K, handler: AutocompleteEvents<TData>[K]): this;
  off<K extends keyof AutocompleteEvents<TData>>(event: K, handler: AutocompleteEvents<TData>[K]): this;
  destroy(): void;
}
