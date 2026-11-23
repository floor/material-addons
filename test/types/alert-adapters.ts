import type { ReactAlertProps } from "../../src/react";
import type { VueAlertProps, VueAlertEmits } from "../../src/vue";
import type { SolidAlertProps } from "../../src/solid";
import type { SvelteAlertProps } from "../../src/adapters/alert/svelte";
import type { AlertElementEventMap } from "../../src/elements/alert";

type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type EventOf<T> = T extends (event: infer Event) => unknown ? Event : never;

export type AlertAdapterChecks = [
  Assert<Same<EventOf<ReactAlertProps["onAction"]>, AlertElementEventMap["action"]>>,
  Assert<Same<EventOf<ReactAlertProps["onBeforedismiss"]>, AlertElementEventMap["beforedismiss"]>>,
  Assert<Same<EventOf<ReactAlertProps["onDismiss"]>, AlertElementEventMap["dismiss"]>>,
  Assert<Same<EventOf<VueAlertEmits["action"]>, AlertElementEventMap["action"]>>,
  Assert<Same<EventOf<VueAlertEmits["beforedismiss"]>, AlertElementEventMap["beforedismiss"]>>,
  Assert<Same<EventOf<VueAlertEmits["dismiss"]>, AlertElementEventMap["dismiss"]>>,
  Assert<Same<EventOf<SolidAlertProps["onAction"]>, AlertElementEventMap["action"]>>,
  Assert<Same<EventOf<SolidAlertProps["onBeforedismiss"]>, AlertElementEventMap["beforedismiss"]>>,
  Assert<Same<EventOf<SolidAlertProps["onDismiss"]>, AlertElementEventMap["dismiss"]>>,
  Assert<Same<EventOf<SvelteAlertProps["onaction"]>, AlertElementEventMap["action"]>>,
  Assert<Same<EventOf<SvelteAlertProps["onbeforedismiss"]>, AlertElementEventMap["beforedismiss"]>>,
  Assert<Same<EventOf<SvelteAlertProps["ondismiss"]>, AlertElementEventMap["dismiss"]>>,
  Assert<Same<VueAlertProps["supportingText"], string | undefined>>,
  Assert<Same<ReactAlertProps["severity"], "info" | "success" | "warning" | "error" | undefined>>,
  Assert<Same<ReactAlertProps["variant"], "tonal" | "outlined" | "filled" | undefined>>,
];
