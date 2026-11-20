import { setHTML } from "material/core/dom";
import { RATING_CLASSES, RATING_DEFAULTS } from "../constants";
import { formatRating } from "../config";
import type { RatingSettings } from "../config";
export interface RatingView {
  state: RatingSettings & { hover: number | null; autoError: boolean };
  root: HTMLElement;
  group: HTMLElement;
  paint: () => void;
  rebuild: () => void;
  focusSelected: () => void;
  syncField: (resetDefault?: boolean) => void;
  cleanups: Array<() => void>;
  suppressClick: boolean;
  handleCommit: (value: number, event?: Event, silent?: boolean) => void;
  handleHover: (value: number | null, event: Event) => void;
}

interface Host {
  element: HTMLElement;
  emit: (name: string, data?: unknown) => void;
}

let nextId = 0;

function starLabel(state: RatingView["state"], value: number): string {
  if (state.getStarLabel) return state.getStarLabel(value, state.max);
  return value === 1 ? "1 star" : `${formatRating(value)} stars`;
}

function near(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.001;
}

export function withStars(settings: RatingSettings) {
  return <T extends Host>(component: T): T & { view: RatingView } => {
    const state: RatingView["state"] = { ...settings, hover: null, autoError: false };
    const root = component.element;
    const document = root.ownerDocument;
    const id = ++nextId;
    const label = document.createElement("span");
    label.className = RATING_CLASSES.LABEL;
    label.id = `mtrl-rating-label-${id}`;
    const row = document.createElement("div");
    row.className = RATING_CLASSES.ROW;
    const group = document.createElement("div");
    group.className = RATING_CLASSES.GROUP;
    const valueText = document.createElement("span");
    valueText.className = RATING_CLASSES.VALUE;
    valueText.setAttribute("aria-hidden", "true");
    const supporting = document.createElement("div");
    supporting.className = RATING_CLASSES.SUPPORTING_TEXT;
    supporting.id = `mtrl-rating-supporting-${id}`;
    row.append(group, valueText);
    root.append(label, row, supporting);

    const view: RatingView = {
      state,
      root,
      group,
      paint: () => {},
      rebuild: () => {},
      focusSelected: () => {},
      syncField: () => {},
      cleanups: [],
      suppressClick: false,
      handleCommit: () => {},
      handleHover: () => {},
    };

    const onEnter = (event: Event) => {
      if (state.readOnly || state.disabled) return;
      const value = Number((event.currentTarget as HTMLElement).dataset.value);
      if (state.hover !== null && near(state.hover, value)) return;
      view.handleHover(value, event);
    };
    // Chromium commits a radio checked flag after click listeners return, which
    // undoes the assignment in paint. Write the model again once that
    // activation has finished.
    const syncChecked = () => {
      const inputs = Array.from(group.querySelectorAll<HTMLInputElement>(`input.${RATING_CLASSES.STOP}`));
      for (const input of inputs) input.checked = near(Number(input.dataset.value), state.value);
    };
    const onClick = (event: Event) => {
      if (view.suppressClick) {
        view.suppressClick = false;
        return;
      }
      if (state.readOnly || state.disabled) return;
      const value = Number((event.currentTarget as HTMLElement).dataset.value);
      const clear = near(value, state.value) && !state.required && !state.noClear;
      view.handleCommit(clear ? 0 : value, event);
      if (event.currentTarget instanceof HTMLInputElement) queueMicrotask(syncChecked);
    };
    const onLeave = (event: Event) => {
      if (state.hover === null) return;
      view.handleHover(null, event);
    };

    const stop = (value: number, half: boolean, primary: boolean) => {
      // The first star is the input that carries setCustomValidity. The other
      // stars stay buttons. No extra control is added for the form.
      const control = primary ? document.createElement("input") : document.createElement("button");
      control.type = primary ? "radio" : "button";
      control.className = half ? `${RATING_CLASSES.STOP} ${RATING_CLASSES.STOP_HALF}` : `${RATING_CLASSES.STOP} ${RATING_CLASSES.STOP_FULL}`;
      control.dataset.value = formatRating(value);
      control.setAttribute("role", "radio");
      control.addEventListener("click", onClick);
      control.addEventListener("pointerenter", onEnter);
      return control;
    };

    const rebuild = () => {
      group.replaceChildren();
      let primary = true;
      for (let index = 1; index <= state.max; index += 1) {
        const star = document.createElement("span");
        star.className = RATING_CLASSES.STAR;
        star.dataset.star = String(index);
        const visual = document.createElement("span");
        visual.className = RATING_CLASSES.STAR_VISUAL;
        visual.setAttribute("aria-hidden", "true");
        const empty = document.createElement("span");
        empty.className = RATING_CLASSES.STAR_EMPTY_ICON;
        const fill = document.createElement("span");
        fill.className = RATING_CLASSES.STAR_FILL_ICON;
        setHTML(empty, state.emptyIcon);
        setHTML(fill, state.icon);
        visual.append(empty, fill);
        star.append(visual);
        if (!state.readOnly) {
          if (state.half) {
            star.append(stop(index - 0.5, true, primary));
            primary = false;
          }
          star.append(stop(index, false, primary));
          primary = false;
        }
        group.append(star);
      }
      paint();
    };

    const paint = () => {
      const display = state.hover ?? state.value;
      root.classList.toggle(`${RATING_CLASSES.ROOT}--small`, state.size === "small");
      root.classList.toggle(`${RATING_CLASSES.ROOT}--medium`, state.size === "medium");
      root.classList.toggle(`${RATING_CLASSES.ROOT}--large`, state.size === "large");
      root.classList.toggle(RATING_CLASSES.DISABLED, state.disabled);
      root.classList.toggle(RATING_CLASSES.READ_ONLY, state.readOnly);
      root.classList.toggle(RATING_CLASSES.ERROR, state.error || state.autoError);
      root.classList.toggle(RATING_CLASSES.HOVERING, state.hover !== null);

      label.hidden = state.label == null || state.label === "";
      label.textContent = state.label ?? "";
      supporting.hidden = state.supportingText == null || state.supportingText === "";
      supporting.textContent = state.supportingText ?? "";
      valueText.hidden = !state.showValue;
      valueText.textContent = formatRating(display);

      const described = state.supportingText ? supporting.id : "";
      if (described) group.setAttribute("aria-describedby", described);
      else group.removeAttribute("aria-describedby");
      if (state.error || state.autoError) group.setAttribute("aria-invalid", "true");
      else group.removeAttribute("aria-invalid");

      if (state.readOnly) {
        const title = state.ariaLabel || state.label;
        const score = `${formatRating(state.value)} of ${state.max} stars`;
        group.setAttribute("role", "img");
        group.setAttribute("aria-label", title ? `${title}: ${score}` : score);
        group.removeAttribute("aria-labelledby");
        group.removeAttribute("aria-required");
        group.removeAttribute("aria-disabled");
      } else {
        group.setAttribute("role", "radiogroup");
        if (state.label && !state.ariaLabel) {
          group.setAttribute("aria-labelledby", label.id);
          group.removeAttribute("aria-label");
        } else {
          group.setAttribute("aria-label", state.ariaLabel || state.label || RATING_DEFAULTS.ARIA_LABEL);
          group.removeAttribute("aria-labelledby");
        }
        if (state.required) group.setAttribute("aria-required", "true");
        else group.removeAttribute("aria-required");
        if (state.disabled) group.setAttribute("aria-disabled", "true");
        else group.removeAttribute("aria-disabled");
      }

      const stars = group.querySelectorAll<HTMLElement>(`.${RATING_CLASSES.STAR}`);
      stars.forEach((star, offset) => {
        const index = offset + 1;
        const fraction = display - (index - 1);
        star.classList.toggle(RATING_CLASSES.STAR_FULL, display >= index - 0.001);
        star.classList.toggle(RATING_CLASSES.STAR_HALF, !state.readOnly && near(display, index - 0.5));
        const partial = state.readOnly && fraction > 0.001 && fraction < 0.999;
        star.classList.toggle(RATING_CLASSES.STAR_FRACTION, partial);
        star.classList.toggle(RATING_CLASSES.STAR_EMPTY, display < index - 0.5 - 0.001 && !partial);
        if (partial) star.style.setProperty("--_star-fill", `${Math.round(fraction * 100)}%`);
        else star.style.removeProperty("--_star-fill");
      });

      const selected = state.value > 0 ? state.value : (state.half ? 0.5 : 1);
      const missing = state.required && !state.disabled && state.value === 0;
      const stops = Array.from(group.querySelectorAll<HTMLButtonElement | HTMLInputElement>(`.${RATING_CLASSES.STOP}`));
      for (const button of stops) {
        const value = Number(button.dataset.value);
        button.setAttribute("aria-checked", near(value, state.value) ? "true" : "false");
        button.setAttribute("aria-label", starLabel(state, value));
        button.tabIndex = !state.disabled && near(value, selected) ? 0 : -1;
        button.disabled = state.disabled;
        if (button instanceof HTMLInputElement) {
          button.checked = near(value, state.value);
          button.setCustomValidity(missing ? "Please select a rating." : "");
        }
      }
      view.syncField(false);
    };

    const focusSelected = () => {
      const target = group.querySelector<HTMLElement>('[tabindex="0"]');
      target?.focus();
    };

    view.paint = paint;
    view.rebuild = rebuild;
    view.focusSelected = focusSelected;
    group.addEventListener("pointerleave", onLeave);
    view.cleanups.push(() => group.removeEventListener("pointerleave", onLeave));
    rebuild();

    return { ...component, view };
  };
}
