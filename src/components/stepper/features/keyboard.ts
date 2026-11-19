// src/components/stepper/features/keyboard.ts

import { createRoving } from "material/core/dom";
import type { Navigation } from "./navigation";
import type { Renderer, StepperHost } from "./renderer";

/**
 * One tab stop on the header list, the arrow keys along the layout (Left and
 * Right following the reading direction, which `createRoving` resolves), Home
 * and End to the ends. Enter and Space activate the focused step.
 */
export const withKeyboard = (
  component: StepperHost,
  renderer: Renderer,
  navigation: Navigation,
  vertical: () => boolean,
  goTo: (index: number) => Promise<boolean>,
): (() => void) => {
  const roving = createRoving({
    container: renderer.list,
    targets: () => renderer.headers.filter((header) => !header.disabled),
    vertical,
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const index = renderer.headers.findIndex((header) => header === event.target);
    if (index < 0) return;
    event.preventDefault();
    void goTo(index);
  };

  const off = (): boolean => component.element.getAttribute("aria-disabled") === "true";

  const onTabStop = (): void => {
    if (off()) {
      renderer.headers.forEach((header) => {
        header.tabIndex = -1;
      });
      return;
    }
    // One header keeps the tab stop; the active step's when it has one
    const active = renderer.headers.find((header) => header.getAttribute("aria-current") === "step" && !header.disabled);
    if (active) {
      renderer.headers.forEach((header) => {
        header.tabIndex = header === active ? 0 : -1;
      });
    }
    roving.sync();
  };

  renderer.list.addEventListener("keydown", onKeyDown);
  renderer.list.addEventListener("focusin", onTabStop);
  onTabStop();

  return () => {
    renderer.list.removeEventListener("keydown", onKeyDown);
    renderer.list.removeEventListener("focusin", onTabStop);
    roving.destroy();
  };
};
