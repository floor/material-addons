import type { ReactExpansionPanelProps, ReactAccordionProps } from "../../src/react";
import type { SolidAccordionProps, SolidExpansionPanelProps } from "../../src/solid";
import type { SvelteAccordionProps, SvelteExpansionPanelProps } from "../../src/adapters/svelte-expansion";
import type { ExpansionPanelElementEventMap } from "../../src/elements";
import type { ExpansionPanelComponent, ExpansionPanelEvents } from "../../src/components/expansion-panel";

type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type EventOf<T> = T extends (event: infer Event) => unknown ? Event : never;
type OpenEvent = ExpansionPanelEvents["open"] extends (event: infer E) => void ? E : never;

export type EventMapChecks = [
  Assert<Same<ExpansionPanelElementEventMap["beforeopen"], CustomEvent<{ value: string }>>>,
  Assert<Same<ExpansionPanelElementEventMap["open"], CustomEvent<OpenEvent>>>,
  Assert<Same<EventOf<ReactExpansionPanelProps["onOpen"]>, ExpansionPanelElementEventMap["open"]>>,
  Assert<Same<EventOf<SvelteExpansionPanelProps["onopen"]>, ExpansionPanelElementEventMap["open"]>>,
  Assert<Same<EventOf<SolidExpansionPanelProps["onBeforeclose"]>, ExpansionPanelElementEventMap["beforeclose"]>>,
];

export type PropChecks = [
  Assert<Same<ReactExpansionPanelProps["variant"], "outlined" | "elevated" | "filled" | undefined>>,
  Assert<Same<ReactAccordionProps["multiSelect"], boolean | undefined>>,
  Assert<Same<SolidExpansionPanelProps["open"], boolean | undefined>>,
  Assert<Same<SvelteAccordionProps["separated"], boolean | undefined>>,
];

const typedPanel: (component: ExpansionPanelComponent) => void = () => undefined;
export { typedPanel };
