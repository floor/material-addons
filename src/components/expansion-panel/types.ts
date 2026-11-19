// src/components/expansion-panel/types.ts

import type { ButtonConfig } from "material/components/button";
import type {
  ExpansionPanelDensity,
  ExpansionPanelPlacement,
  ExpansionPanelVariant,
} from "./constants";

export type HeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface ExpansionPanelBeforeEvent {
  component: ExpansionPanelComponent;
  /** The panel's identifier */
  value: string;
  /** Call to cancel the opening or the closing */
  preventDefault: () => void;
  readonly defaultPrevented: boolean;
}

export interface ExpansionPanelEvent {
  component: ExpansionPanelComponent;
  value: string;
  /** The state the panel is in */
  open: boolean;
}

export interface ExpansionPanelEvents {
  beforeopen: (event: ExpansionPanelBeforeEvent) => void;
  open: (event: ExpansionPanelEvent) => void;
  afteropen: (event: ExpansionPanelEvent) => void;
  beforeclose: (event: ExpansionPanelBeforeEvent) => void;
  close: (event: ExpansionPanelEvent) => void;
  afterclose: (event: ExpansionPanelEvent) => void;
  change: (event: ExpansionPanelEvent) => void;
}

export type ExpansionPanelContent =
  | string
  | HTMLElement
  | DocumentFragment
  | ((body: HTMLElement, panel: ExpansionPanelComponent) => void);

export type ExpansionPanelActions = HTMLElement | ButtonConfig[];

export interface ExpansionPanelConfig {
  /** Stable identifier the accordion's value model uses */
  value?: string;
  label?: string | Node;
  supportingText?: string | Node;
  /** Body content: markup, a node, or a render function (`lazy` defers it) */
  content?: ExpansionPanelContent;
  /** Footer actions, as nodes or as the card's button configs */
  actions?: ExpansionPanelActions;
  variant?: ExpansionPanelVariant;
  density?: ExpansionPanelDensity;
  placement?: ExpansionPanelPlacement;
  /** Hides the chevron */
  noToggle?: boolean;
  /** Markup for the leading icon in the header */
  leadingIcon?: string;
  /** Markup that replaces the chevron */
  trailingIcon?: string;
  open?: boolean;
  error?: boolean;
  disabled?: boolean;
  /** Draws a divider between the header and the body while open */
  divider?: boolean;
  /** Defers a function `content` until the first open */
  lazy?: boolean;
  headingLevel?: HeadingLevel;
  /** Overrides the header button's accessible name */
  ariaLabel?: string;
  class?: string;
  componentName?: string;

  onBeforeOpen?: ExpansionPanelEvents["beforeopen"];
  onOpen?: ExpansionPanelEvents["open"];
  onAfterOpen?: ExpansionPanelEvents["afteropen"];
  onBeforeClose?: ExpansionPanelEvents["beforeclose"];
  onClose?: ExpansionPanelEvents["close"];
  onAfterClose?: ExpansionPanelEvents["afterclose"];
  onChange?: ExpansionPanelEvents["change"];
  on?: Partial<ExpansionPanelEvents>;
}

export interface AccordionChangeEvent {
  component: AccordionComponent;
  /** The primary open panel's value, null when all are closed */
  value: string | null;
  /** Every open panel's value */
  values: string[];
  /** The panel whose state changed */
  panel: ExpansionPanelComponent;
  open: boolean;
}

export interface AccordionEvents {
  change: (event: AccordionChangeEvent) => void;
}

export interface AccordionConfig {
  panels?: Array<ExpansionPanelConfig | ExpansionPanelComponent>;
  value?: string | null;
  values?: string[];
  multiSelect?: boolean;
  variant?: ExpansionPanelVariant;
  density?: ExpansionPanelDensity;
  placement?: ExpansionPanelPlacement;
  /** Every panel keeps its own rounded container, closed or open */
  separated?: boolean;
  disabled?: boolean;
  class?: string;
  componentName?: string;
  onChange?: AccordionEvents["change"];
  on?: Partial<AccordionEvents>;
}

/** The parts a panel exposes, for its features and the API */
export interface ExpansionPanelParts {
  heading: HTMLElement;
  header: HTMLButtonElement;
  toggle: HTMLElement | null;
  leadingIcon: HTMLElement | null;
  label: HTMLElement;
  supportingText: HTMLElement;
  region: HTMLElement;
  regionInner: HTMLElement;
  divider: HTMLElement | null;
  body: HTMLElement;
  actions: HTMLElement | null;
  /** Draws a label or supporting text: a node replaces the text */
  setLabel: (label: string | Node | undefined) => void;
  setSupportingText: (text: string | Node | undefined) => void;
  setLeadingIcon: (markup: string | undefined) => void;
  setToggle: (markup: string | undefined) => void;
}

export interface ExpansionPanelComponent {
  element: HTMLElement;
  parts: ExpansionPanelParts;
  /** The header trigger button */
  header: HTMLButtonElement;
  /** The collapsible region */
  region: HTMLElement;
  /** The body container */
  body: HTMLElement;
  open: () => ExpansionPanelComponent;
  close: () => ExpansionPanelComponent;
  toggle: (force?: boolean) => ExpansionPanelComponent;
  isOpen: () => boolean;
  /** Opens or closes silently: no change, no callbacks */
  setOpen: (open: boolean) => ExpansionPanelComponent;
  getValue: () => string;
  setValue: (value: string) => ExpansionPanelComponent;
  getLabel: () => string;
  setLabel: (label: string) => ExpansionPanelComponent;
  getSupportingText: () => string;
  setSupportingText: (text: string, isError?: boolean) => ExpansionPanelComponent;
  setError: (error: boolean, supportingText?: string) => ExpansionPanelComponent;
  isError: () => boolean;
  setVariant: (variant: ExpansionPanelVariant) => ExpansionPanelComponent;
  getVariant: () => ExpansionPanelVariant;
  setDensity: (density: ExpansionPanelDensity) => ExpansionPanelComponent;
  getDensity: () => ExpansionPanelDensity;
  setPlacement: (placement: ExpansionPanelPlacement) => ExpansionPanelComponent;
  getPlacement: () => ExpansionPanelPlacement;
  setContent: (content: ExpansionPanelContent | undefined, body?: HTMLElement) => ExpansionPanelComponent;
  setActions: (actions: ExpansionPanelActions | undefined) => ExpansionPanelComponent;
  enable: () => ExpansionPanelComponent;
  disable: () => ExpansionPanelComponent;
  isDisabled: () => boolean;
  focus: () => ExpansionPanelComponent;
  on: <K extends keyof ExpansionPanelEvents>(event: K, handler: ExpansionPanelEvents[K]) => ExpansionPanelComponent;
  off: <K extends keyof ExpansionPanelEvents>(event: K, handler: ExpansionPanelEvents[K]) => ExpansionPanelComponent;
  destroy: () => void;
}

export interface AccordionComponent {
  element: HTMLElement;
  getValue: () => string | null;
  setValue: (value: string | null) => AccordionComponent;
  getValues: () => string[];
  setValues: (values: string[]) => AccordionComponent;
  getPanels: () => ExpansionPanelComponent[];
  getPanel: (valueOrIndex: string | number) => ExpansionPanelComponent | null;
  addPanel: (panel: ExpansionPanelConfig | ExpansionPanelComponent, index?: number) => AccordionComponent;
  removePanel: (valueOrIndex: string | number) => AccordionComponent;
  openAll: () => AccordionComponent;
  closeAll: () => AccordionComponent;
  enable: () => AccordionComponent;
  disable: () => AccordionComponent;
  isDisabled: () => boolean;
  on: <K extends keyof AccordionEvents>(event: K, handler: AccordionEvents[K]) => AccordionComponent;
  off: <K extends keyof AccordionEvents>(event: K, handler: AccordionEvents[K]) => AccordionComponent;
  destroy: () => void;
}
