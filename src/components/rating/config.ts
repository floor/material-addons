import type { withElement } from "material/core/compose";
import { RATING_DEFAULTS, RATING_ICONS, RATING_SIZES } from "./constants";
import type { RatingConfig, RatingSize } from "./types";

export function ratingSize(value: string | undefined): RatingSize {
  if (value === RATING_SIZES.SMALL || value === RATING_SIZES.LARGE || value === RATING_SIZES.MEDIUM) return value;
  return RATING_DEFAULTS.SIZE;
}

export function normalizeMax(max: number | undefined): number {
  const rounded = Math.round(Number(max));
  return Number.isFinite(rounded) && rounded >= 1 ? rounded : RATING_DEFAULTS.MAX;
}

/** Read-only scores keep a fractional part. Interactive scores snap to the step. */
export function normalizeValue(value: number, max: number, half: boolean, readOnly: boolean): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const clamped = Math.min(max, Math.max(0, numeric));
  const rounded = Math.round(clamped * 1000) / 1000;
  if (readOnly || rounded === 0) return rounded;
  const step = half ? 0.5 : 1;
  return Math.min(max, Math.max(0, Math.round(rounded / step) * step));
}

export function formatRating(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export interface RatingSettings {
  value: number;
  initialValue: number;
  max: number;
  half: boolean;
  readOnly: boolean;
  disabled: boolean;
  required: boolean;
  noClear: boolean;
  size: RatingSize;
  error: boolean;
  showValue: boolean;
  icon: string;
  emptyIcon: string;
  label?: string;
  ariaLabel?: string;
  supportingText?: string;
  getStarLabel?: RatingConfig["getStarLabel"];
  name?: string;
  className?: string;
  componentName: string;
  onChange?: RatingConfig["onChange"];
  onHover?: RatingConfig["onHover"];
}

export function createBaseConfig(config: RatingConfig = {}): RatingSettings {
  const half = config.precision === 0.5 ? true : config.precision === 1 ? false : config.half === true;
  const readOnly = config.readOnly === true;
  const max = normalizeMax(config.max);
  const initialValue = normalizeValue(config.defaultValue ?? config.value ?? 0, max, half, readOnly);
  const value = config.value === undefined ? initialValue : normalizeValue(config.value, max, half, readOnly);
  const className = [config.class, config.className].flat().filter((name): name is string => typeof name === "string" && name.length > 0);
  return {
    value,
    initialValue,
    max,
    half,
    readOnly,
    disabled: config.disabled === true,
    required: config.required === true,
    noClear: config.noClear === true,
    size: ratingSize(config.size),
    error: config.error === true,
    showValue: config.showValue === true,
    icon: config.icon ?? RATING_ICONS.FILLED,
    emptyIcon: config.emptyIcon ?? RATING_ICONS.EMPTY,
    label: config.label,
    ariaLabel: config.ariaLabel,
    supportingText: config.supportingText,
    getStarLabel: config.getStarLabel,
    name: config.name,
    className: className.join(" "),
    componentName: config.componentName ?? "rating",
    onChange: config.onChange,
    onHover: config.onHover,
  };
}

export function getElementConfig(settings: RatingSettings): Parameters<typeof withElement>[0] {
  return {
    tag: "div",
    componentName: settings.componentName,
    className: settings.className,
  };
}
