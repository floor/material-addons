import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import { connectClick, initialize, type AvatarClick, type AvatarProps } from "./contract";
import type { AvatarElement } from "../../elements/avatar";

export { attributes, hostProps, tag } from "./contract";
export type SvelteAvatarProps = AvatarProps & { onclick?: AvatarClick; children?: Snippet } &
  Omit<HTMLAttributes<HTMLElement>, keyof AvatarProps | "onclick" | "children">;

export function connectAvatar(node: AvatarElement, click: AvatarClick | undefined) {
  initialize();
  const connection = connectClick(node);
  connection.update(click);
  return connection;
}
