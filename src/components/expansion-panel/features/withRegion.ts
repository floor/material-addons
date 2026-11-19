// src/components/expansion-panel/features/withRegion.ts

import { createDivider } from "material/components/divider";
import { setHTML } from "material/core/dom";
import { EXPANSION_PANEL_CLASSES } from "../constants";
import type { ExpansionPanelSettings } from "../config";
import type {
  ExpansionPanelActions,
  ExpansionPanelComponent,
  ExpansionPanelContent,
  ExpansionPanelParts,
} from "../types";

export interface RegionFeature {
  region: HTMLElement;
  regionInner: HTMLElement;
  body: HTMLElement;
  actions: HTMLElement;
  /** Renders content, deferring a function when the panel is lazy and closed */
  setContent: (content: ExpansionPanelContent | undefined) => void;
  setActions: (actions: ExpansionPanelActions | undefined) => void;
  /** Applies the open state's DOM and resolves once the transition settled */
  apply: (open: boolean, immediate?: boolean) => Promise<void>;
}

interface RegionHost {
  element: HTMLElement;
  getClass: (name: string) => string;
}

const DURATION_FALLBACK = 250;

const durationOf = (element: HTMLElement): number => {
  if (typeof getComputedStyle !== "function") return DURATION_FALLBACK;
  const raw = getComputedStyle(element).transitionDuration;
  const first = Number.parseFloat(String(raw ?? "").split(",")[0] ?? "");
  return Number.isFinite(first) ? Math.max(0, first * 1000) : DURATION_FALLBACK;
};

const fill = (target: HTMLElement, content: ExpansionPanelContent | undefined, panel: ExpansionPanelComponent): void => {
  target.replaceChildren();
  if (content === undefined || content === null) return;
  if (typeof content === "string") setHTML(target, content);
  else if (typeof content === "function") content(target, panel);
  else target.appendChild(content as Node);
};

/** Builds the collapsible region and its content, and owns the collapse */
export const withRegion =
  (settings: ExpansionPanelSettings) =>
  (component: RegionHost, parts: ExpansionPanelParts, self: () => ExpansionPanelComponent): RegionFeature => {
    const cls = (name: string): string => component.getClass(name);

    const region = document.createElement("div");
    region.className = cls(EXPANSION_PANEL_CLASSES.REGION);
    region.id = `${component.element.id || cls(EXPANSION_PANEL_CLASSES.ROOT)}-region`;
    region.setAttribute("role", "region");
    region.setAttribute("aria-labelledby", parts.header.id);
    region.hidden = true;
    region.inert = true;

    const inner = document.createElement("div");
    inner.className = cls(EXPANSION_PANEL_CLASSES.REGION_INNER);

    let divider: HTMLElement | null = null;
    if (settings.divider) {
      const created = createDivider({ variant: "full-width" }) as unknown as { element?: HTMLElement } | HTMLElement;
      divider = (created as { element?: HTMLElement }).element ?? (created as HTMLElement);
      divider.classList.add(cls(EXPANSION_PANEL_CLASSES.DIVIDER));
      inner.appendChild(divider);
    }

    const body = document.createElement("div");
    body.className = cls(EXPANSION_PANEL_CLASSES.BODY);
    inner.appendChild(body);

    const actions = document.createElement("div");
    actions.className = cls(EXPANSION_PANEL_CLASSES.ACTIONS);
    actions.hidden = true;
    inner.appendChild(actions);

    region.appendChild(inner);
    component.element.appendChild(region);
    parts.header.setAttribute("aria-controls", region.id);
    parts.region = region;
    parts.regionInner = inner;
    parts.divider = divider;
    parts.body = body;
    parts.actions = actions;

    let rendered = false;
    let pending: ExpansionPanelContent | undefined = settings.content;

    const render = (): void => {
      if (rendered) return;
      fill(body, pending, self());
      rendered = true;
    };
    if (!settings.lazy) render();

    const setContent = (content: ExpansionPanelContent | undefined): void => {
      pending = content;
      rendered = false;
      body.replaceChildren();
      if (!settings.lazy || !region.hidden) render();
    };

    const setActions = (value: ExpansionPanelActions | undefined): void => {
      actions.replaceChildren();
      if (!value) {
        actions.hidden = true;
        return;
      }
      if (Array.isArray(value)) {
        for (const config of value) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `${cls("expansion-panel")}__action`;
          button.textContent = String((config as { text?: string }).text ?? "");
          for (const [name, handler] of Object.entries({
            click: (config as { onClick?: (event: MouseEvent) => void }).onClick,
          })) {
            if (typeof handler === "function") button.addEventListener(name, handler as EventListener);
          }
          actions.appendChild(button);
        }
        actions.hidden = false;
      } else {
        actions.appendChild(value as Node);
        actions.hidden = false;
      }
    };
    setActions(settings.actions);

    let settleToken = 0;
    const apply = (open: boolean, immediate = false): Promise<void> => {
      const token = ++settleToken;
      if (open) {
        render();
        region.hidden = false;
        region.inert = false;
      } else {
        region.inert = true;
      }
      parts.header.setAttribute("aria-expanded", String(open));
      const settle = (): void => {
        if (token !== settleToken) return;
        if (open) {
          region.inert = false;
        } else {
          region.hidden = true;
          region.inert = true;
        }
      };
      if (immediate) {
        settle();
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        let done = false;
        const finish = (): void => {
          if (done) return;
          done = true;
          inner.removeEventListener("transitionend", onEnd);
          settle();
          resolve();
        };
        const onEnd = (event: TransitionEvent): void => {
          if (event.target === inner) finish();
        };
        inner.addEventListener("transitionend", onEnd);
        window.setTimeout(finish, durationOf(inner) + 40);
      });
    };

    return { region, regionInner: inner, body, actions, setContent, setActions, apply };
  };
