import { createBase, pipe, withElement, withEvents, withLifecycle } from "material/core/compose";
import { RATING_ICONS } from "./constants";
import { createBaseConfig, getElementConfig, normalizeMax, normalizeValue, ratingSize } from "./config";
import { withForm } from "./features/withForm";
import { withKeyboard } from "./features/withKeyboard";
import { withStars, type RatingView } from "./features/withStars";
import type { RatingComponent, RatingConfig, RatingController, RatingEvents } from "./types";

interface Built {
  element: HTMLElement;
  view: RatingView;
  lifecycle: { destroy: () => void };
  on: (event: string, handler: (payload: never) => void) => unknown;
  off: (event: string, handler: (payload: never) => void) => unknown;
  emit: (event: string, data?: unknown) => void;
  destroy: () => void;
}

function bindRating(component: Built): RatingController {
  const { view } = component;
  const state = view.state;
  let api: RatingController;

  const renorm = () => {
    state.initialValue = normalizeValue(state.initialValue, state.max, state.half, state.readOnly);
    const next = normalizeValue(state.value, state.max, state.half, state.readOnly);
    view.rebuild();
    if (next !== state.value) view.handleCommit(next);
    else view.paint();
  };

  view.handleCommit = (value, event, silent = false) => {
    const previous = state.value;
    state.value = normalizeValue(value, state.max, state.half, state.readOnly);
    state.hover = null;
    if (state.autoError && state.value > 0) state.autoError = false;
    view.paint();
    if (!silent && state.value !== previous) {
      component.emit("change", { value: state.value, previousValue: previous, originalEvent: event });
    }
  };

  view.handleHover = (value, event) => {
    state.hover = value;
    view.paint();
    component.emit("hover", { value, originalEvent: event });
  };

  const checkValidity = () => !(!state.disabled && state.required && state.value === 0);

  api = {
    get element() { return component.element; },
    getValue: () => state.value,
    setValue(value, silent) {
      view.handleCommit(value, undefined, silent === true);
      return api;
    },
    clear() {
      view.handleCommit(0);
      return api;
    },
    getMax: () => state.max,
    setMax(max) {
      state.max = normalizeMax(max);
      renorm();
      return api;
    },
    isHalf: () => state.half,
    setHalf(half) {
      state.half = half;
      renorm();
      return api;
    },
    isReadOnly: () => state.readOnly,
    setReadOnly(readOnly) {
      state.readOnly = readOnly;
      renorm();
      return api;
    },
    isDisabled: () => state.disabled,
    setDisabled(disabled) {
      state.disabled = disabled;
      view.paint();
      return api;
    },
    isRequired: () => state.required,
    setRequired(required) {
      state.required = required;
      view.paint();
      return api;
    },
    setNoClear(noClear) {
      state.noClear = noClear;
      return api;
    },
    setShowValue(show) {
      state.showValue = show;
      view.paint();
      return api;
    },
    setAriaLabel(label) {
      state.ariaLabel = label || undefined;
      view.paint();
      return api;
    },
    setName(name) {
      state.name = name || undefined;
      view.syncField(true);
      return api;
    },
    setIcon(icon) {
      state.icon = icon || RATING_ICONS.FILLED;
      view.rebuild();
      return api;
    },
    setEmptyIcon(icon) {
      state.emptyIcon = icon || RATING_ICONS.EMPTY;
      view.rebuild();
      return api;
    },
    getSize: () => state.size,
    setSize(size) {
      state.size = ratingSize(typeof size === "string" ? size : undefined);
      view.paint();
      return api;
    },
    getLabel: () => state.label,
    setLabel(label) {
      state.label = label || undefined;
      view.paint();
      return api;
    },
    getSupportingText: () => state.supportingText,
    setSupportingText(text, isError) {
      state.supportingText = text || undefined;
      if (isError !== undefined) state.error = isError;
      view.paint();
      return api;
    },
    isError: () => state.error || state.autoError,
    setError(error, supportingText) {
      state.error = error;
      state.autoError = false;
      if (supportingText !== undefined) state.supportingText = supportingText || undefined;
      view.paint();
      return api;
    },
    checkValidity,
    reportValidity() {
      const valid = checkValidity();
      if (!valid) {
        state.autoError = true;
        view.paint();
        view.focusSelected();
      }
      return valid;
    },
    on(event, handler) {
      component.on(event, handler as (payload: never) => void);
      return api;
    },
    off(event, handler) {
      component.off(event, handler as (payload: never) => void);
      return api;
    },
    destroy() {
      for (const cleanup of view.cleanups.splice(0)) cleanup();
      component.lifecycle.destroy();
    },
  };

  if (state.onChange) api.on("change", state.onChange);
  if (state.onHover) api.on("hover", state.onHover);
  return api;
}

/**
 * Creates a star rating. Half steps follow the writing direction. The control
 * is a radio group, or a read-only image when `readOnly` is set.
 */
export const createRating = (config: RatingConfig = {}): RatingComponent => {
  const settings = createBaseConfig(config);
  const rating = (pipe as unknown as (...fns: Array<(value: never) => never>) => (value: never) => RatingController)(
    createBase as unknown as (value: never) => never,
    withEvents() as unknown as (value: never) => never,
    withElement(getElementConfig(settings)) as unknown as (value: never) => never,
    withStars(settings) as unknown as (value: never) => never,
    withKeyboard() as unknown as (value: never) => never,
    withForm() as unknown as (value: never) => never,
    withLifecycle() as unknown as (value: never) => never,
    ((component: Built) => bindRating(component)) as unknown as (value: never) => never,
  )(settings as unknown as never);
  return rating;
};
