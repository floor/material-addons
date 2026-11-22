// src/components/tree/index.ts

/**
 * Tree component module: the owned-DOM factory. The virtual entry is
 * separate (`material-addons/components/tree/virtual`) and is the only one
 * that imports vlist.
 *
 * @module components/tree
 */

export { default as createTree } from "./tree";
export { default } from "./tree";

export type {
  TreeActivateEvent, TreeBeforeChangeEvent, TreeBeforeExpandEvent, TreeChangeEvent,
  TreeComponent, TreeConfig, TreeErrorEvent, TreeExpandEvent, TreeLoadEvent,
  TreeNode, TreePlacement, TreeSelection,
} from "./types";
