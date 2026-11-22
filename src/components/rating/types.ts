import type { BaseConfig } from "material/core/compose";
import type { RATING_SIZES } from "./constants";

export type RatingSize = (typeof RATING_SIZES)[keyof typeof RATING_SIZES];

export interface RatingChangeEvent {
  value: number;
  previousValue: number;
  originalEvent?: Event;
}

export interface RatingHoverEvent {
  /** Hovered rating value, or null when the pointer leaves the star group. */
  value: number | null;
  originalEvent: MouseEvent | PointerEvent;
}

export interface RatingEvents {
  change: (payload: RatingChangeEvent) => void;
  hover: (payload: RatingHoverEvent) => void;
}

export interface RatingConfig extends BaseConfig {
  /** Extra classes on the root. A string or a list of class names. */
  class?: string | string[];
  /** Alias of `class`. */
  className?: string | string[];
  /** Current rating value (0 = unrated, up to `max`). @default 0 */
  value?: number;
  /** Initial value restored on form reset. */
  defaultValue?: number;
  /** Maximum number of stars (integer >= 1). @default 5 */
  max?: number;
  /** Whether half-star increments (0.5) are enabled. @default false */
  half?: boolean;
  /** Optional step precision alias (`0.5` enables `half: true`, `1` uses whole stars). */
  precision?: 1 | 0.5;
  /** When true, renders a non-interactive rating indicator. @default false */
  readOnly?: boolean;
  /** Whether the rating control is disabled. @default false */
  disabled?: boolean;
  /** Whether a rating > 0 is required for form validity. @default false */
  required?: boolean;
  /** When true, clicking the already-selected star does not clear the rating to 0. @default false */
  noClear?: boolean;
  /** Star visual size ('small' = 18px, 'medium' = 24px, 'large' = 32px). @default 'medium' */
  size?: RatingSize | string;
  /** Visible field label above the stars. */
  label?: string;
  /** Accessible name for the radiogroup when `label` is omitted. @default 'Rating' */
  ariaLabel?: string;
  /** Secondary helper or error text below the stars. */
  supportingText?: string;
  /** Error state flag. @default false */
  error?: boolean;
  /** When true, displays the numeric value readout beside the stars. @default false */
  showValue?: boolean;
  /** Custom filled star SVG markup. */
  icon?: string;
  /** Custom empty star SVG markup. */
  emptyIcon?: string;
  /** Custom accessible label formatter for each radio stop. */
  getStarLabel?: (value: number, max: number) => string;
  /** Form field name. When set, syncs a hidden input and listens for form reset. */
  name?: string;
  onChange?: RatingEvents["change"];
  onHover?: RatingEvents["hover"];
}

export interface RatingComponent {
  element: HTMLElement;
  getValue: () => number;
  setValue: (value: number) => RatingComponent;
  clear: () => RatingComponent;
  getMax: () => number;
  setMax: (max: number) => RatingComponent;
  isHalf: () => boolean;
  setHalf: (half: boolean) => RatingComponent;
  isReadOnly: () => boolean;
  setReadOnly: (readOnly: boolean) => RatingComponent;
  isDisabled: () => boolean;
  setDisabled: (disabled: boolean) => RatingComponent;
  isRequired: () => boolean;
  setRequired: (required: boolean) => RatingComponent;
  getSize: () => RatingSize;
  setSize: (size: RatingSize | string) => RatingComponent;
  getLabel: () => string | undefined;
  setLabel: (label: string | undefined) => RatingComponent;
  getSupportingText: () => string | undefined;
  setSupportingText: (text: string | undefined, isError?: boolean) => RatingComponent;
  isError: () => boolean;
  setError: (error: boolean, supportingText?: string) => RatingComponent;
  checkValidity: () => boolean;
  reportValidity: () => boolean;
  on: <K extends keyof RatingEvents>(event: K, handler: RatingEvents[K]) => RatingComponent;
  off: <K extends keyof RatingEvents>(event: K, handler: RatingEvents[K]) => RatingComponent;
  destroy: () => void;
}

/** Attribute updates and form restore use these hooks. They are not part of the factory surface. */
export interface RatingController extends RatingComponent {
  setValue: (value: number, silent?: boolean) => RatingComponent;
  setNoClear: (noClear: boolean) => RatingComponent;
  setShowValue: (show: boolean) => RatingComponent;
  setAriaLabel: (label: string | undefined) => RatingComponent;
  setName: (name: string | undefined) => RatingComponent;
  setIcon: (icon: string | undefined) => RatingComponent;
  setEmptyIcon: (icon: string | undefined) => RatingComponent;
}
