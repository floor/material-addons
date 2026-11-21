// src/components/tree/types.ts

/** The selection model: none, single (`value`), or multiple (`values`). */
export type TreeSelection = "none" | "single" | "multiple";

/** The inline edge the disclosure control paints on. */
export type TreePlacement = "start" | "end";

/** One node of the tree. `value` is the stable id, never a DOM id. */
export interface TreeNode {
  value: string;
  label: string;
  supportingText?: string;
  leadingIcon?: string;
  disabled?: boolean;
  expanded?: boolean;
  /** Parent whose children load on first expand. */
  lazy?: boolean;
  children?: TreeNode[];
}

export interface TreeBeforeExpandEvent {
  value: string;
  node: TreeNode;
  preventDefault: () => void;
  readonly defaultPrevented: boolean;
}

export interface TreeExpandEvent {
  value: string;
  node: TreeNode;
}

export interface TreeBeforeChangeEvent {
  previousValue: string | null;
  /** Node being selected, toggled, or the proposed single value. */
  value: string | null;
  previousValues?: string[];
  values?: string[];
  preventDefault: () => void;
  readonly defaultPrevented: boolean;
}

export interface TreeChangeEvent {
  previousValue: string | null;
  value: string | null;
  previousValues?: string[];
  values?: string[];
}

export interface TreeActivateEvent {
  value: string;
  node: TreeNode;
  originalEvent?: Event;
}

export interface TreeLoadEvent {
  value: string;
  node: TreeNode;
}

export interface TreeErrorEvent {
  value: string;
  node: TreeNode;
}

export interface TreeConfig {
  nodes?: TreeNode[];
  selection?: TreeSelection;
  /** Single selection. Null when nothing is selected. */
  value?: string | null;
  /** Multiple selection. */
  values?: string[];
  /** false, true, or the ids that start open. Default false. */
  expanded?: boolean | string[];
  selectionFollowsFocus?: boolean;
  placement?: TreePlacement;
  expandOnClick?: boolean;
  /** Default true. The element opt-out is noTypeAhead. */
  typeAhead?: boolean;
  indent?: number;
  loadChildren?: (node: TreeNode) => Promise<TreeNode[]>;
  ariaLabel?: string;
  disabled?: boolean;
  class?: string;
  componentName?: string;
  onBeforeExpand?: (event: TreeBeforeExpandEvent) => void;
  onExpand?: (event: TreeExpandEvent) => void;
  onBeforeCollapse?: (event: TreeBeforeExpandEvent) => void;
  onCollapse?: (event: TreeExpandEvent) => void;
  onBeforeChange?: (event: TreeBeforeChangeEvent) => void;
  onChange?: (event: TreeChangeEvent) => void;
  onActivate?: (event: TreeActivateEvent) => void;
  onLoad?: (event: TreeLoadEvent) => void;
  onError?: (event: TreeErrorEvent) => void;
}

export interface TreeComponent {
  element: HTMLElement;
  getValue: () => string | null;
  setValue: (value: string | null) => TreeComponent;
  getValues: () => string[];
  setValues: (values: string[]) => TreeComponent;
  select: (value: string) => boolean;
  expand: (value: string) => boolean;
  collapse: (value: string) => boolean;
  toggle: (value: string) => boolean;
  expandAll: () => TreeComponent;
  collapseAll: () => TreeComponent;
  getExpanded: () => string[];
  getNode: (value: string) => TreeNode | null;
  setNodes: (nodes: TreeNode[]) => TreeComponent;
  enable: () => void;
  disable: () => void;
  isDisabled: () => boolean;
  on: (event: string, handler: (payload: never) => void) => TreeComponent;
  off: (event: string, handler: (payload: never) => void) => TreeComponent;
  focus: () => void;
  destroy: () => void;
}
