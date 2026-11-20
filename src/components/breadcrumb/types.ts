// src/components/breadcrumb/types.ts

export interface BreadcrumbItemConfig {
  value?: string;
  label: string;
  href?: string;
  disabled?: boolean;
}

export interface BreadcrumbItemState {
  value: string;
  label: string;
  index: number;
  href?: string;
  disabled: boolean;
  current: boolean;
}

export interface BreadcrumbBeforeChangeEvent {
  previousValue: string | null;
  value: string;
  previousItem: BreadcrumbItemState | null;
  item: BreadcrumbItemState;
  preventDefault: () => void;
  readonly defaultPrevented: boolean;
}

export interface BreadcrumbChangeEvent {
  value: string;
  previousValue: string | null;
  item: BreadcrumbItemState;
  previousItem: BreadcrumbItemState | null;
}

export interface BreadcrumbEvents {
  beforechange: (event: BreadcrumbBeforeChangeEvent) => void;
  change: (event: BreadcrumbChangeEvent) => void;
}

export interface BreadcrumbConfig {
  /** The trail, root first, current last */
  items?: BreadcrumbItemConfig[];
  /** Current item value. Defaults to the last item; null only when the trail is empty. */
  value?: string | null;
  /** Collapse the overflowing middle items into a menu. `<m-breadcrumb no-collapse>` opts out. */
  collapse?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  overflowLabel?: string;
  /** Replaces the trail separator glyph */
  separator?: string;
  class?: string;
  componentName?: string;
  onBeforeChange?: BreadcrumbEvents["beforechange"];
  onChange?: BreadcrumbEvents["change"];
  on?: Partial<BreadcrumbEvents>;
}

export interface BreadcrumbComponent {
  element: HTMLElement;
  getValue: () => string | null;
  setValue: (value: string | null) => BreadcrumbComponent;
  getItems: () => BreadcrumbItemState[];
  setItems: (items: BreadcrumbItemConfig[]) => BreadcrumbComponent;
  getItem: (value: string) => BreadcrumbItemState | null;
  goTo: (value: string) => boolean;
  open: () => BreadcrumbComponent;
  close: () => BreadcrumbComponent;
  isOpen: () => boolean;
  enable: () => BreadcrumbComponent;
  disable: () => BreadcrumbComponent;
  isDisabled: () => boolean;
  on: <K extends keyof BreadcrumbEvents>(event: K, handler: BreadcrumbEvents[K]) => BreadcrumbComponent;
  off: <K extends keyof BreadcrumbEvents>(event: K, handler: BreadcrumbEvents[K]) => BreadcrumbComponent;
  destroy: () => void;
}
