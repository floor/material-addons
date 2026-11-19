// src/components/stepper/features/orientation.ts

import { STEPPER_EVENTS, STEPPER_ORIENTATIONS } from "../constants";
import type { StepperSettings } from "../config";
import type { StepperResolvedOrientation, StepperOrientationChangeEvent } from "../types";

/**
 * Resolves `orientation: "auto"` from the root's own width, not the viewport:
 * a stepper in a narrow pane stays vertical in a wide window.
 */
export const withAutoOrientation = (
  component: { element: HTMLElement; emit: (event: string, data?: unknown) => void },
  settings: StepperSettings,
): { resolved: () => StepperResolvedOrientation; destroy: () => void; onChange: (handler: () => void) => void } => {
  let current: StepperResolvedOrientation =
    settings.orientation === STEPPER_ORIENTATIONS.VERTICAL ? "vertical" : "horizontal";
  let observer: ResizeObserver | null = null;
  const listeners: Array<() => void> = [];

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  const resolve = (width: number): void => {
    const next: StepperResolvedOrientation =
      settings.orientation === STEPPER_ORIENTATIONS.VERTICAL
        ? "vertical"
        : settings.orientation === STEPPER_ORIENTATIONS.AUTO && width < settings.autoBreakpoint
          ? "vertical"
          : "horizontal";
    if (next === current) return;
    current = next;
    component.emit(STEPPER_EVENTS.ORIENTATION_CHANGE, { orientation: next } satisfies StepperOrientationChangeEvent);
    notify();
  };

  const observe = (): void => {
    if (settings.orientation !== STEPPER_ORIENTATIONS.AUTO) return;
    if (typeof ResizeObserver === "undefined") return;
    observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? component.element.getBoundingClientRect().width;
      resolve(width);
    });
    observer.observe(component.element);
  };

  observe();

  return {
    resolved: () => current,
    destroy: () => {
      observer?.disconnect();
      observer = null;
      listeners.length = 0;
    },
    onChange: (handler: () => void) => listeners.push(handler),
  };
};
