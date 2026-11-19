// src/components/expansion-panel/features/withHeader.ts

import { setHTML } from "material/core/dom";
import {
  EXPANSION_PANEL_CLASSES,
  EXPANSION_PANEL_MODIFIERS,
  EXPANSION_PANEL_PLACEMENTS,
  EXPANSION_PANEL_TOGGLE_ICON,
} from "../constants";
import type { ExpansionPanelSettings } from "../config";
import type { ExpansionPanelComponent, ExpansionPanelParts } from "../types";

export interface HeaderFeature extends ExpansionPanelParts {
  /** Whether the label or supporting text holds a node the caller gave */
  sync: (state: { open: boolean; error: boolean; disabled: boolean }) => void;
}

interface HeaderHost {
  element: HTMLElement;
  getClass: (name: string) => string;
  componentName?: string;
}

/** One id per panel instance: two panels never share a disclosure pair */
let instance = 0;
export const nextInstanceId = (): string => `mtrl-expansion-panel-${++instance}`;

const headingLevelOf = (value: unknown): number => {
  const level = Number(value);
  return Number.isInteger(level) && level >= 2 && level <= 6 ? level : 3;
};

/** Builds the heading, the trigger button and everything inside it */
export const withHeader =
  (settings: ExpansionPanelSettings) =>
  (component: HeaderHost): HeaderFeature => {
    const cls = (name: string): string => component.getClass(name);
    const element = component.element;
    element.replaceChildren();

    const headingTag = `h${headingLevelOf(settings.headingLevel)}`;
    const heading = document.createElement(headingTag);
    heading.className = cls(EXPANSION_PANEL_CLASSES.HEADING);

    const header = document.createElement("button");
    header.type = "button";
    header.className = cls(EXPANSION_PANEL_CLASSES.HEADER);
    header.id = `${nextInstanceId()}-header`;

    const ripple = document.createElement("span");
    ripple.className = cls(EXPANSION_PANEL_CLASSES.RIPPLE);
    ripple.setAttribute("aria-hidden", "true");
    header.appendChild(ripple);

    const toggle = document.createElement("span");
    toggle.className = cls(EXPANSION_PANEL_CLASSES.TOGGLE);
    toggle.setAttribute("aria-hidden", "true");

    const leadingIcon = document.createElement("span");
    leadingIcon.className = cls(EXPANSION_PANEL_CLASSES.LEADING_ICON);
    leadingIcon.setAttribute("aria-hidden", "true");

    const content = document.createElement("span");
    content.className = cls(EXPANSION_PANEL_CLASSES.HEADER_CONTENT);
    const label = document.createElement("span");
    label.className = cls(EXPANSION_PANEL_CLASSES.LABEL);
    const supportingText = document.createElement("span");
    supportingText.className = cls(EXPANSION_PANEL_CLASSES.SUPPORTING_TEXT);
    content.append(label, supportingText);

    const setNode = (holder: HTMLElement, value: string | Node | undefined): void => {
      holder.replaceChildren();
      if (value instanceof Node) holder.appendChild(value);
      else holder.textContent = value ?? "";
    };

    const parts: ExpansionPanelParts = {
      heading,
      header,
      toggle,
      leadingIcon,
      label,
      supportingText,
      region: null as unknown as HTMLElement,
      regionInner: null as unknown as HTMLElement,
      divider: null,
      body: null as unknown as HTMLElement,
      actions: null,
      setLabel: (value) => setNode(label, value),
      setSupportingText: (value) => setNode(supportingText, value),
      setLeadingIcon: (markup) => {
        leadingIcon.replaceChildren();
        if (markup) setHTML(leadingIcon, markup);
      },
      setToggle: (markup) => {
        toggle.replaceChildren();
        setHTML(toggle, markup ?? EXPANSION_PANEL_TOGGLE_ICON);
      },
    };

    parts.setLabel(settings.label);
    parts.setSupportingText(settings.supportingText);
    parts.setLeadingIcon(settings.leadingIcon);
    parts.setToggle(settings.trailingIcon);

    const compose = (): void => {
      const start = settings.placement === EXPANSION_PANEL_PLACEMENTS.START;
      header.replaceChildren(ripple);
      if (start) header.appendChild(toggle);
      if (settings.leadingIcon) header.appendChild(leadingIcon);
      header.appendChild(content);
      if (!start) header.appendChild(toggle);
    };
    compose();

    const sync = (state: { open: boolean; error: boolean; disabled: boolean }): void => {
      const visible = !settings.noToggle;
      toggle.hidden = !visible;
      leadingIcon.hidden = !settings.leadingIcon;
      supportingText.hidden = !supportingText.textContent;
      header.setAttribute("aria-expanded", String(state.open));
      element.classList.toggle(cls(EXPANSION_PANEL_MODIFIERS.OPEN), state.open);
      element.classList.toggle(cls(EXPANSION_PANEL_MODIFIERS.ERROR), state.error);
      element.classList.toggle(cls(EXPANSION_PANEL_MODIFIERS.DISABLED), state.disabled);
      element.classList.toggle(
        cls(EXPANSION_PANEL_MODIFIERS.COMPACT),
        settings.density === "compact",
      );
      [
        EXPANSION_PANEL_MODIFIERS.OUTLINED,
        EXPANSION_PANEL_MODIFIERS.ELEVATED,
        EXPANSION_PANEL_MODIFIERS.FILLED,
      ].forEach((name) => element.classList.toggle(cls(name), name.endsWith(settings.variant!)));
      element.classList.toggle(
        cls(EXPANSION_PANEL_MODIFIERS.PLACEMENT_START),
        settings.placement === EXPANSION_PANEL_PLACEMENTS.START,
      );
      header.disabled = state.disabled;
      if (settings.ariaLabel) header.setAttribute("aria-label", settings.ariaLabel);
      else header.removeAttribute("aria-label");
    };

    heading.appendChild(header);
    element.appendChild(heading);
    return Object.assign(parts, { sync }) as HeaderFeature & { sync: typeof sync };
  };
