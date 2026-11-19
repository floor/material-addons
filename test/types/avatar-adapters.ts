import type { ReactAvatarProps } from "../../src/react";
import type { VueAvatarProps } from "../../src/vue";
import type { SolidAvatarProps } from "../../src/solid";
import type { SvelteAvatarProps } from "../../src/adapters/avatar/svelte";
import type { AvatarElementEventMap } from "../../src/elements/avatar";

type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type EventOf<T> = T extends (event: infer Event) => unknown ? Event : never;

export type AvatarAdapterChecks = [
  Assert<Same<EventOf<ReactAvatarProps["onClick"]>, AvatarElementEventMap["click"]>>,
  Assert<Same<EventOf<VueAvatarProps["onClick"]>, AvatarElementEventMap["click"]>>,
  Assert<Same<EventOf<SolidAvatarProps["onClick"]>, AvatarElementEventMap["click"]>>,
  Assert<Same<EventOf<SvelteAvatarProps["onclick"]>, AvatarElementEventMap["click"]>>,
  Assert<Same<SvelteAvatarProps["supportingText"], string | undefined>>,
  Assert<Same<ReactAvatarProps["size"], "small" | "medium" | "large" | undefined>>,
];
