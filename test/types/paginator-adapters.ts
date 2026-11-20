import type { ReactPaginatorProps } from "../../src/react";
import type { VuePaginatorProps } from "../../src/vue";
import type { SolidPaginatorProps } from "../../src/solid";
import type { SveltePaginatorProps } from "../../src/adapters/paginator/svelte";
import type { PaginatorElementEventMap } from "../../src/adapters/paginator";
import type { PaginatorChangeEvent, PaginatorComponent } from "../../src/components/paginator";

type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type EventOf<T> = T extends (event: infer Event) => unknown ? Event : never;

export type EventMapChecks = [
  Assert<Same<PaginatorElementEventMap["change"], CustomEvent<{ page: number; pageSize: number }>>>,
  Assert<Same<EventOf<ReactPaginatorProps["onChange"]>, PaginatorElementEventMap["change"]>>,
  Assert<Same<EventOf<SveltePaginatorProps["onchange"]>, PaginatorElementEventMap["change"]>>,
];

export type PropChecks = [
  Assert<Same<ReactPaginatorProps["page"], number | undefined>>,
  Assert<Same<ReactPaginatorProps["pageSizes"], number[] | undefined>>,
  Assert<Same<ReactPaginatorProps["numbered"], boolean | undefined>>,
  Assert<Same<VuePaginatorProps["total"], number | undefined>>,
  Assert<Same<SolidPaginatorProps["pageSize"], number | undefined>>,
];

export type ComponentChecks = [
  Assert<Same<ReturnType<PaginatorComponent["goTo"]>, boolean>>,
  Assert<Same<ReturnType<PaginatorComponent["getRange"]>["end"], number>>,
  Assert<Same<PaginatorChangeEvent["previousPage"], number>>,
];

const typedPaginator: (component: PaginatorComponent) => void = () => undefined;
export { typedPaginator };
