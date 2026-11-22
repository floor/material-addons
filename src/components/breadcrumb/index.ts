// src/components/breadcrumb/index.ts

/**
 * Breadcrumb module: a trail of ancestor links with the current page last.
 * The barrel exports the factory and its public types; the constants live on
 * `material-addons/components/breadcrumb/constants`.
 *
 * @module components/breadcrumb
 */

export { default as createBreadcrumb } from "./breadcrumb";
export type {
  BreadcrumbBeforeChangeEvent,
  BreadcrumbChangeEvent,
  BreadcrumbComponent,
  BreadcrumbConfig,
  BreadcrumbEvents,
  BreadcrumbItemConfig,
  BreadcrumbItemState,
} from "./types";
