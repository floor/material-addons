import type { ReactBreadcrumbProps } from "../../src/react";
import type { VueBreadcrumbProps } from "../../src/vue";
import type { SolidBreadcrumbProps } from "../../src/solid";
import type { SvelteBreadcrumbProps } from "../../src/adapters/breadcrumb/svelte";
import type { BreadcrumbElementEventMap } from "../../src/adapters/breadcrumb";
import type { BreadcrumbComponent, BreadcrumbItemState } from "../../src/components/breadcrumb";

type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type EventOf<T> = T extends (event: infer Event) => unknown ? Event : never;

export type EventMapChecks = [
  Assert<Same<BreadcrumbElementEventMap["beforechange"], CustomEvent<{ previousValue: string | null; value: string }>>>,
  Assert<Same<BreadcrumbElementEventMap["change"], CustomEvent<{ value: string; previousValue: string | null }>>>,
  Assert<Same<EventOf<ReactBreadcrumbProps["onBeforechange"]>, BreadcrumbElementEventMap["beforechange"]>>,
  Assert<Same<EventOf<SvelteBreadcrumbProps["onchange"]>, BreadcrumbElementEventMap["change"]>>,
];

export type PropChecks = [
  Assert<Same<ReactBreadcrumbProps["value"], string | null | undefined>>,
  Assert<Same<ReactBreadcrumbProps["noCollapse"], boolean | undefined>>,
  Assert<Same<ReactBreadcrumbProps["overflowLabel"], string | undefined>>,
  Assert<Same<VueBreadcrumbProps["ariaLabel"], string | undefined>>,
  Assert<Same<SolidBreadcrumbProps["disabled"], boolean | undefined>>,
];

export type ComponentChecks = [
  Assert<Same<ReturnType<BreadcrumbComponent["getValue"]>, string | null>>,
  Assert<Same<ReturnType<BreadcrumbComponent["goTo"]>, boolean>>,
  Assert<Same<BreadcrumbItemState["current"], boolean>>,
];

const typedBreadcrumb: (component: BreadcrumbComponent) => void = () => undefined;
export { typedBreadcrumb };
