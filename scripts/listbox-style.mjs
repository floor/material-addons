import { readFileSync } from "node:fs";

// The peer exposes document CSS through this JS entry. Use the same sheet in
// the element's shadow root so the popup and its options share the peer styles.
export function readListboxStyle() {
  const entry = import.meta.resolve("material/styles/listbox");
  const source = readFileSync(new URL(entry), "utf8");
  const sheet = /^\s*import\s+["']\.\/listbox\.css["'];?\s*$/.test(source);
  if (!sheet) throw new Error("material/styles/listbox no longer loads ./listbox.css");
  return readFileSync(new URL("listbox.css", entry), "utf8");
}
