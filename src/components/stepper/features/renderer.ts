// src/components/stepper/features/renderer.ts

import { setHTML } from "material/core/dom";
import { STEPPER_CLASSES, STEPPER_ICONS, STEPPER_MODIFIERS } from "../constants";
import { canReach, type StepperSettings } from "../config";
import type { StepState, StepperComponent } from "../types";

/** What every feature after the renderer reads */
export interface Renderer {
  list: HTMLOListElement;
  panels: HTMLElement;
  live: HTMLElement;
  /** The panel body of each step, by index */
  bodies: HTMLElement[];
  /** The header button of each step, by index */
  headers: HTMLButtonElement[];
  /** The wrapper holding each step's panel, by index */
  wrappers: HTMLElement[];
  /** The `.mtrl-stepper__panel` of each step, by index */
  panelElements: HTMLElement[];
  render: (steps: StepState[], contents?: Array<unknown>) => void;
  sync: (steps: StepState[], resolved: "horizontal" | "vertical") => void;
  destroy: () => void;
}

/**
 * Every match of a selector in a panel, the panel's own and the content its
 * slots assigned: a form inside a slotted `<m-step>` is the panel's content.
 */
export const queryPanel = <T extends Element>(panel: HTMLElement | null, selector: string): T[] => {
  if (!panel) return [];
  const matches = Array.from(panel.querySelectorAll<T>(selector));
  for (const slot of Array.from(panel.querySelectorAll("slot"))) {
    const assigned = (slot as HTMLSlotElement).assignedElements?.({ flatten: true }) ?? [];
    for (const root of assigned) {
      if (root.matches(selector)) matches.push(root as unknown as T);
      matches.push(...Array.from(root.querySelectorAll<T>(selector)));
    }
  }
  return matches;
};

export interface StepperHost {
  element: HTMLElement;
  getClass: (name: string) => string;
  emit: (event: string, data?: unknown) => void;
}

/** The step status spoken as part of the header's name */
const statusText = (
  step: StepState,
  settings: StepperSettings,
): string => {
  if (step.error) return step.supportingText ? `, Error: ${step.supportingText}` : ", Error";
  if (step.completed) return step.editable ? ", Completed, Editable" : ", Completed";
  if (step.optional) return ", Optional";
  return "";
};

/** The supporting line under the label: the step's own text, the error copy, or the optional caption */
export const supportingTextOf = (
  step: StepState,
  settings: StepperSettings,
): string => {
  if (step.error) return step.supportingText ?? "";
  if (step.supportingText) return step.supportingText;
  if (step.optional) return settings.optionalSupportingText;
  return "";
};

/** Builds the stepper's own DOM: live region, header list, panels */
export const withRenderer = (settings: StepperSettings) => (component: StepperHost): Renderer => {
  const cls = (name: string): string => component.getClass(name);
  const element = component.element;

  element.replaceChildren();

  const live = document.createElement("div");
  live.className = cls(STEPPER_CLASSES.LIVE);
  live.setAttribute("aria-live", "polite");
  live.setAttribute("aria-atomic", "true");
  element.appendChild(live);

  // The compact read-outs are always built and shown by the `hidden`
  // attribute: with no stylesheet at all, a hidden list is out of the tab
  // order and out of the accessibility tree, which CSS alone cannot promise.
  const count = document.createElement("p");
  count.className = cls(STEPPER_CLASSES.COUNT);
  count.hidden = true;
  element.appendChild(count);

  const progress = document.createElement("div");
  progress.className = cls(STEPPER_CLASSES.PROGRESS);
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", settings.ariaLabel);
  progress.setAttribute("aria-valuemin", "0");
  progress.hidden = true;
  const progressBar = document.createElement("div");
  progressBar.className = cls(STEPPER_CLASSES.PROGRESS_BAR);
  const progressFill = document.createElement("span");
  progressFill.setAttribute("aria-hidden", "true");
  progressBar.appendChild(progressFill);
  const progressLabel = document.createElement("span");
  progressLabel.className = cls(STEPPER_CLASSES.PROGRESS_LABEL);
  // The bar's aria-valuetext carries the step text; the visible copy repeats it
  progressLabel.setAttribute("aria-hidden", "true");
  progress.append(progressBar, progressLabel);
  element.appendChild(progress);

  const list = document.createElement("ol");
  list.className = cls(STEPPER_CLASSES.LIST);
  element.appendChild(list);

  const panels = document.createElement("div");
  panels.className = cls(STEPPER_CLASSES.PANELS);
  element.appendChild(panels);

  const bodies: HTMLElement[] = [];
  const headers: HTMLButtonElement[] = [];
  const wrappers: HTMLElement[] = [];
  const panelElements: HTMLElement[] = [];

  const stepContent = (step: StepState): HTMLElement => {
    const body = document.createElement("div");
    body.className = cls(STEPPER_CLASSES.PANEL_BODY);
    bodies.push(body);
    return body;
  };

  const fillContent = (step: StepState, body: HTMLElement, declaration: unknown): void => {
    const content = (declaration as { content?: unknown })?.content;
    if (!content) return;
    if (typeof content === "string") setHTML(body, content);
    else if (typeof content === "function") (content as (panel: HTMLElement, step: StepState) => void)(body, step);
    else if (content instanceof HTMLElement || (typeof DocumentFragment !== "undefined" && content instanceof DocumentFragment)) {
      body.appendChild(content);
    }
  };

  const render = (steps: StepState[], contents: Array<unknown> = []): void => {
    list.replaceChildren();
    panels.replaceChildren();
    bodies.length = 0;
    headers.length = 0;
    wrappers.length = 0;
    panelElements.length = 0;

    steps.forEach((step, index) => {
      const item = document.createElement("li");
      item.className = cls(STEPPER_CLASSES.ITEM);
      item.dataset.stepIndex = String(index);
      item.dataset.stepValue = step.value;

      const header = document.createElement("button");
      header.type = "button";
      header.className = cls(STEPPER_CLASSES.HEADER);
      header.id = `${element.id || cls(STEPPER_CLASSES.ROOT)}-header-${index}`;
      header.dataset.stepIndex = String(index);

      // The M3 state layer and ripple surface, as in every interactive surface
      const ripple = document.createElement("span");
      ripple.className = cls(STEPPER_CLASSES.RIPPLE);
      ripple.setAttribute("aria-hidden", "true");
      header.appendChild(ripple);

      const indicator = document.createElement("span");
      indicator.className = cls(STEPPER_CLASSES.INDICATOR);
      indicator.setAttribute("aria-hidden", "true");
      header.appendChild(indicator);

      const group = document.createElement("span");
      group.className = cls(STEPPER_CLASSES.LABEL_GROUP);
      const label = document.createElement("span");
      label.className = cls(STEPPER_CLASSES.LABEL);
      label.textContent = step.label;
      const supporting = document.createElement("span");
      supporting.className = cls(STEPPER_CLASSES.SUPPORTING_TEXT);
      supporting.id = `${header.id}-supporting`;
      group.append(label, supporting);

      const sr = document.createElement("span");
      sr.className = cls(STEPPER_CLASSES.SR_STATUS);
      group.appendChild(sr);

      header.appendChild(group);
      item.appendChild(header);

      const connector = document.createElement("div");
      connector.className = cls(STEPPER_CLASSES.CONNECTOR);
      connector.setAttribute("aria-hidden", "true");
      item.appendChild(connector);

      const wrapper = document.createElement("div");
      wrapper.className = cls(STEPPER_CLASSES.PANEL_WRAPPER);
      wrapper.dataset.stepIndex = String(index);
      wrappers.push(wrapper);

      const panel = document.createElement("section");
      panel.className = cls(STEPPER_CLASSES.PANEL);
      panel.id = `${element.id || cls(STEPPER_CLASSES.ROOT)}-panel-${index}`;
      panel.setAttribute("aria-labelledby", header.id);
      panel.setAttribute("role", "region");

      panelElements.push(panel);
      const inner = document.createElement("div");
      inner.className = cls(STEPPER_CLASSES.PANEL_INNER);
      const body = stepContent(step);
      fillContent(step, body, { content: contents[index] });
      inner.appendChild(body);
      panel.appendChild(inner);
      wrapper.appendChild(panel);

      header.setAttribute("aria-controls", panel.id);
      headers.push(header);
      list.appendChild(item);
      panels.appendChild(wrapper);
    });
  };

  // Compact labels: when the measured labels do not fit the row, the inactive
  // steps show their indicator only and the active step keeps its label. The
  // decision is a pure function of the labels' own measured widths and the
  // row's width, so it cannot depend on the mode it is measured in: it does
  // not go stale when the steps change, and it cannot flap
  let compact = false;
  let iconOnly = false;
  let lastResolved: "horizontal" | "vertical" = "horizontal";

  const measureLabels = (resolved: "horizontal" | "vertical"): void => {
    lastResolved = resolved;
    const reset = (): void => {
      compact = false;
      iconOnly = false;
      element.classList.remove(cls(STEPPER_MODIFIERS.COMPACT_LABELS), cls(STEPPER_MODIFIERS.COMPACT_ICONS));
    };
    lastWidth = element.clientWidth;
    if (resolved !== "horizontal" || settings.display !== "labels" || element.clientWidth === 0) {
      reset();
      return;
    }
    // Measure the real full layout: the classes come off, every label is read
    // as it renders there, and the answer is whether anything is clipped —
    // the same test a reader sees, so a row that fits in full mode (a wide
    // row, or labels that wrap into their share) stays in it
    element.classList.remove(
      cls(STEPPER_MODIFIERS.COMPACT_LABELS),
      cls(STEPPER_MODIFIERS.COMPACT_ICONS),
      cls(STEPPER_MODIFIERS.DISPLAY_DOTS),
      cls(STEPPER_MODIFIERS.COMPACT_DOTS),
    );
    const style = getComputedStyle(element);
    const value = (name: string, fallback: number): number =>
      Number.parseFloat(style.getPropertyValue(name)) || fallback;
    const padding = value("--mtrl-stepper-header-padding", 16);
    const indicator = value("--mtrl-stepper-indicator-size", 24);
    const gap = value("--mtrl-stepper-header-gap", 12);
    const fixed = 2 * padding + indicator + gap;
    const indicatorOnly = 2 * padding + indicator;
    const railMin = 8 + 4;
    const items = Array.from(list.children) as HTMLElement[];
    const labels = items
      .map((item) => item.querySelector<HTMLElement>(`.${cls(STEPPER_CLASSES.LABEL)}`))
      .filter((label): label is HTMLElement => Boolean(label && (label.textContent ?? "").trim()));
    const clipped = labels.some((label) => label.scrollWidth > label.clientWidth + 1);
    const overflows = list.scrollWidth > element.clientWidth + 1;
    if (!clipped && !overflows) {
      compact = false;
      iconOnly = false;
      return;
    }
    compact = true;
    // Not even a small label box beside the indicators: the active label goes
    // too. The icon row has its own tighter padding, and when even that row
    // cannot hold the steps the dots display takes over
    let compactFootprint = 0;
    let rails = 0;
    for (const item of items) {
      const rail = item.querySelector(`.${cls(STEPPER_CLASSES.CONNECTOR)}`);
      const active = item.classList.contains(cls(STEPPER_MODIFIERS.ACTIVE));
      compactFootprint += active ? fixed : indicatorOnly;
      if (rail) {
        compactFootprint += railMin;
        rails += 1;
      }
    }
    const width = element.clientWidth;
    iconOnly = compactFootprint + 16 > width + 1;
    const iconFootprint = items.length * (2 * 8 + indicator) + rails * railMin;
    const dotsFallback = iconOnly && iconFootprint > width + 1;
    element.classList.toggle(cls(STEPPER_MODIFIERS.DISPLAY_DOTS), dotsFallback);
    element.classList.toggle(cls(STEPPER_MODIFIERS.COMPACT_DOTS), dotsFallback);
    element.classList.toggle(cls(STEPPER_MODIFIERS.COMPACT_LABELS), compact);
    element.classList.toggle(cls(STEPPER_MODIFIERS.COMPACT_ICONS), iconOnly);
  };

  // A forced horizontal stepper has no orientation observer to lean on, so
  // the renderer watches its own width for the compact threshold. Only an
  // inline-size change re-decides — the class change itself alters the height,
  // which would otherwise feed straight back — and the class write is deferred
  // to the next frame, out of the observer callback, so a transition cannot
  // raise a resize loop
  let lastWidth = -1;
  let measureFrame: number | null = null;
  const scheduleMeasure = (): void => {
    if (measureFrame !== null) return;
    const raf = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (callback: (time: number) => void) => setTimeout(() => callback(0), 0) as unknown as number;
    measureFrame = raf(() => {
      measureFrame = null;
      measureLabels(lastResolved);
    });
  };
  let labelObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver === "function") {
    labelObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? element.clientWidth;
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      scheduleMeasure();
    });
    labelObserver.observe(element);
  }

  const sync = (steps: StepState[], resolved: "horizontal" | "vertical"): void => {
    const vertical = resolved === "vertical";
    element.classList.toggle(cls(STEPPER_MODIFIERS.VERTICAL), vertical);
    element.classList.toggle(cls(STEPPER_MODIFIERS.HORIZONTAL), !vertical);
    element.classList.toggle(cls(STEPPER_MODIFIERS.VALIDATING), steps.some((step) => step.validating));
    const active = steps.find((step) => step.active);
    const readout = active ? `Step ${active.index + 1} of ${steps.length}: ${active.label}` : "";
    count.textContent = readout;
    progress.setAttribute("aria-valuemax", String(steps.length));
    progress.setAttribute("aria-valuenow", String(active ? active.index + 1 : 0));
    progress.setAttribute("aria-valuetext", readout);
    progressLabel.textContent = readout;
    progressFill.style.width = active ? `${((active.index + 1) / Math.max(steps.length, 1)) * 100}%` : "0%";
    // The layout options travel with the state, not only the creation classes.
    // A bottom label is a horizontal arrangement — the number over the words,
    // the rail through the headers — so a vertical stepper reads it as the end
    // label instead: the number stays beside the label and the connector under
    // the number, whatever the container did to resolve `orientation: "auto"`.
    const labelPlacement = vertical && settings.labelPlacement === "bottom" ? "end" : settings.labelPlacement;
    element.classList.toggle(
      cls(STEPPER_MODIFIERS.LABEL_BOTTOM),
      labelPlacement === "bottom",
    );
    element.classList.toggle(
      cls(STEPPER_MODIFIERS.LABEL_END),
      labelPlacement !== "bottom",
    );
    element.classList.toggle(
      cls(STEPPER_MODIFIERS.HEADER_BOTTOM),
      settings.headerPlacement === "bottom",
    );
    element.classList.toggle(
      cls(STEPPER_MODIFIERS.HEADER_TOP),
      settings.headerPlacement !== "bottom",
    );
    element.classList.toggle(cls(STEPPER_MODIFIERS.AUTO), settings.orientation === "auto");
    element.classList.toggle(cls(STEPPER_MODIFIERS.DISPLAY_LABELS), settings.display === "labels");
    element.classList.toggle(cls(STEPPER_MODIFIERS.DISPLAY_COUNT), settings.display === "count");
    element.classList.toggle(cls(STEPPER_MODIFIERS.DISPLAY_DOTS), settings.display === "dots");
    element.classList.toggle(cls(STEPPER_MODIFIERS.DISPLAY_PROGRESS), settings.display === "progress");
    measureLabels(resolved);
    const compactDisplay = settings.display === "count" || settings.display === "progress";
    list.hidden = compactDisplay;
    count.hidden = settings.display !== "count";
    progress.hidden = settings.display !== "progress";
    const off = element.getAttribute("aria-disabled") === "true";

    steps.forEach((step, index) => {
      const item = list.children[index] as HTMLElement | undefined;
      const header = headers[index];
      const wrapper = wrappers[index];
      const panel = wrapper?.firstElementChild as HTMLElement | undefined;
      if (!item || !header || !panel) return;

      const indicator = header.querySelector(`.${cls(STEPPER_CLASSES.INDICATOR)}`) as HTMLElement;
      const supporting = header.querySelector(`.${cls(STEPPER_CLASSES.SUPPORTING_TEXT)}`) as HTMLElement;
      const sr = header.querySelector(`.${cls(STEPPER_CLASSES.SR_STATUS)}`) as HTMLElement;

      item.classList.toggle(cls(STEPPER_MODIFIERS.ACTIVE), step.active);
      item.classList.toggle(cls(STEPPER_MODIFIERS.COMPLETED), step.completed);
      item.classList.toggle(cls(STEPPER_MODIFIERS.EDITABLE), step.editable);
      item.classList.toggle(cls(STEPPER_MODIFIERS.OPTIONAL), step.optional);
      item.classList.toggle(cls(STEPPER_MODIFIERS.ERROR), step.error);
      item.classList.toggle(cls(STEPPER_MODIFIERS.DISABLED_ITEM), step.disabled);
      item.classList.toggle(cls(STEPPER_MODIFIERS.VALIDATING_ITEM), step.validating);

      if (step.active) header.setAttribute("aria-current", "step");
      else header.removeAttribute("aria-current");
      if (vertical) header.setAttribute("aria-expanded", String(step.active));
      else header.removeAttribute("aria-expanded");
      if (step.error) {
        header.setAttribute("aria-invalid", "true");
        if (supporting.textContent) header.setAttribute("aria-errormessage", supporting.id);
        else header.removeAttribute("aria-errormessage");
      } else {
        header.removeAttribute("aria-invalid");
        header.removeAttribute("aria-errormessage");
      }
      if (step.disabled) {
        header.disabled = true;
        header.setAttribute("aria-disabled", "true");
      } else {
        header.disabled = false;
        // A linear-locked step stays in the sequence but cannot be activated
        if (settings.linear && !canReach(steps, index, true)) header.setAttribute("aria-disabled", "true");
        else header.removeAttribute("aria-disabled");
      }
      // One tab stop, on the active header; a disabled stepper has none
      header.tabIndex = !off && step.active ? 0 : -1;
      if (step.validating) header.setAttribute("aria-busy", "true");
      else header.removeAttribute("aria-busy");

      const glyph = step.error
        ? settings.icons?.error ?? STEPPER_ICONS.ERROR
        : step.completed
          ? step.editable && !step.active
            ? settings.icons?.edit ?? STEPPER_ICONS.EDIT
            : settings.icons?.check ?? STEPPER_ICONS.CHECK
          : step.icon ?? String(index + 1);
      if (glyph.trim().startsWith("<")) setHTML(indicator, glyph);
      else indicator.textContent = glyph;
      indicator.setAttribute("aria-hidden", "true");

      supporting.textContent = supportingTextOf(step, settings);
      sr.textContent = statusText(step, settings);

      panel.hidden = !step.active;
      if (wrapper) {
        wrapper.hidden = !step.active;
        // Vertical: the panel sits under its own header; horizontal: the panels
        // share one region below the list. In a compact display the list is
        // hidden, so its panels stay in the shared region too.
        const parent = vertical && !compactDisplay ? item : panels;
        if (wrapper.parentElement !== parent) parent.appendChild(wrapper);
      }
    });
  };

  return {
    list,
    panels,
    live,
    bodies,
    headers,
    wrappers,
    panelElements,
    render,
    sync,
    destroy: () => {
      labelObserver?.disconnect();
      labelObserver = null;
      if (measureFrame !== null) {
        if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(measureFrame);
        else clearTimeout(measureFrame);
        measureFrame = null;
      }
      element.replaceChildren();
    },
  };
};
