// src/components/stepper/features/renderer.ts

import { setHTML } from "material/core/dom";
import { STEPPER_CLASSES, STEPPER_ICONS, STEPPER_MODIFIERS } from "../constants";
import type { StepperSettings } from "../config";
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
  render: (steps: StepState[], contents?: Array<unknown>) => void;
  sync: (steps: StepState[], resolved: "horizontal" | "vertical") => void;
  destroy: () => void;
}

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

  const list = document.createElement("ol");
  list.className = cls(STEPPER_CLASSES.LIST);
  element.appendChild(list);

  const panels = document.createElement("div");
  panels.className = cls(STEPPER_CLASSES.PANELS);
  element.appendChild(panels);

  const bodies: HTMLElement[] = [];
  const headers: HTMLButtonElement[] = [];
  const wrappers: HTMLElement[] = [];

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

  const sync = (steps: StepState[], resolved: "horizontal" | "vertical"): void => {
    const vertical = resolved === "vertical";
    element.classList.toggle(cls(STEPPER_MODIFIERS.VERTICAL), vertical);
    element.classList.toggle(cls(STEPPER_MODIFIERS.HORIZONTAL), !vertical);
    element.classList.toggle(cls(STEPPER_MODIFIERS.VALIDATING), steps.some((step) => step.validating));

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
        header.removeAttribute("aria-disabled");
      }
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
        // share one region below the list. Moving the wrapper never touches the
        // consumer's step elements, which carry no order of their own.
        const parent = vertical ? item : panels;
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
    render,
    sync,
    destroy: () => element.replaceChildren(),
  };
};
