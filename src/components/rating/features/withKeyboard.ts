import type { RatingView } from "./withStars";

interface Host {
  view: RatingView;
}

function readingRtl(group: HTMLElement): boolean {
  const marked = Boolean(group.closest("[dir=rtl]"));
  try {
    return group.matches(":dir(rtl)") || marked;
  } catch {
    return marked;
  }
}

function near(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.001;
}

export function withKeyboard() {
  return <T extends Host>(component: T): T => {
    const { view } = component;
    const onKey = (event: KeyboardEvent) => {
      const state = view.state;
      if (state.readOnly || state.disabled) return;
      const step = state.half ? 0.5 : 1;
      const min = state.required || state.noClear ? step : 0;
      const rtl = readingRtl(view.group);
      const key = event.key;
      let next: number | undefined;
      if (key === "ArrowRight" || key === "ArrowLeft" || key === "ArrowUp" || key === "ArrowDown") {
        event.preventDefault();
        const forward = key === "ArrowUp" || (key === "ArrowRight" && !rtl) || (key === "ArrowLeft" && rtl);
        const backward = key === "ArrowDown" || (key === "ArrowLeft" && !rtl) || (key === "ArrowRight" && rtl);
        if (forward) next = state.value === 0 ? step : Math.min(state.max, state.value + step);
        else if (backward) next = Math.max(min, state.value - step);
      } else if (key === "Home") {
        event.preventDefault();
        next = step;
      } else if (key === "End") {
        event.preventDefault();
        next = state.max;
      } else if ((key === "0" || key === "Backspace" || key === "Delete") && !state.required && !state.noClear && state.value > 0) {
        event.preventDefault();
        next = 0;
      } else if (key === " " || key === "Enter") {
        const target = event.target;
        if (!(target instanceof Element) || !view.group.contains(target)) return;
        const value = Number((target as HTMLElement).dataset.value);
        if (!Number.isFinite(value)) return;
        event.preventDefault();
        view.suppressClick = true;
        const release = () => { view.suppressClick = false; };
        const onUp = (up: KeyboardEvent) => {
          if (up.key === " " || up.key === "Enter") up.preventDefault();
          view.group.removeEventListener("keyup", onUp);
          release();
        };
        view.group.addEventListener("keyup", onUp);
        queueMicrotask(release);
        const clear = near(value, state.value) && !state.required && !state.noClear;
        view.handleCommit(clear ? 0 : value, event);
        view.focusSelected();
        return;
      }
      if (next === undefined || near(next, state.value)) return;
      view.handleCommit(next, event);
      view.focusSelected();
    };
    view.group.addEventListener("keydown", onKey);
    view.cleanups.push(() => view.group.removeEventListener("keydown", onKey));
    return component;
  };
}
