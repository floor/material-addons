// src/components/paginator/index.ts

/**
 * Paginator module: one page of a set, with a rows-per-page select and page
 * navigation. The barrel exports the factory and its public types; the
 * constants live on `material-addons/components/paginator/constants`.
 *
 * @module components/paginator
 */

export { default as createPaginator } from "./paginator";
export type {
  PaginatorBeforeChangeEvent,
  PaginatorChangeEvent,
  PaginatorComponent,
  PaginatorConfig,
  PaginatorEvents,
  PaginatorRange,
} from "./types";
