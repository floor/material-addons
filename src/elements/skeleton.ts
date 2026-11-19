// src/elements/skeleton.ts
/**
 * `<m-skeleton>`: the placeholder as a custom element.
 *
 * Client only: server rendering of the element is deferred until `material`'s
 * renderer accepts another package's specs. The element has no events and no
 * model — it is a loading placeholder, not a control — and its shape parts
 * (`skeleton`, `shape`, `line`) are styleable through `::part()`.
 *
 * @module elements
 */

import {
  defineElement,
  type DefineOptions,
  type ElementSpec,
} from "material/elements";
import createSkeleton from "../components/skeleton";
import type { SkeletonComponent, SkeletonConfig } from "../components/skeleton/types";

/** An attribute's value as the shared updater hands it over. */
type SkeletonAttributeValue = NonNullable<NonNullable<ElementSpec<SkeletonComponent>["attributes"]>[string]["update"]> extends (...args: infer A) => unknown ? A[1] : never;

const skeletonSpec = {
  name: "skeleton",
  ssr: false,
  styles: ["skeleton"],
  hostStyles: ":host{display:block}",
  create: (config: Record<string, unknown>) => createSkeleton(config as SkeletonConfig),
  attributes: {
    variant: { type: "string", config: "variant", update: (c: SkeletonComponent, value: SkeletonAttributeValue) => void c.setVariant(value === null ? "text" : String(value)) },
    size: { type: "string", config: "size", update: (c: SkeletonComponent, value: SkeletonAttributeValue) => void c.setSize(value === null ? "medium" : String(value)) },
    lines: { type: "number", config: "lines", update: (c: SkeletonComponent, value: SkeletonAttributeValue) => void c.setLines(Number(value ?? 1)) },
    motion: { type: "string", config: "motion", update: (c: SkeletonComponent, value: SkeletonAttributeValue) => void c.setMotion(value === null ? "wave" : String(value)) },
    // `no-busy` is the presence opt-out: busy is the default
    "no-busy": { type: "boolean", update: (c: SkeletonComponent, value: SkeletonAttributeValue) => void c.setBusy(!value) },
  },
  properties: {
    variant: { get: (c) => c.getVariant(), set: (c, value) => void c.setVariant(String(value)), config: "variant" },
    size: { get: (c) => c.getSize(), set: (c, value) => void c.setSize(String(value)), config: "size" },
    lines: { get: (c) => c.getLines(), set: (c, value) => void c.setLines(Number(value ?? 1)), config: "lines" },
    motion: { get: (c) => c.getMotion(), set: (c, value) => void c.setMotion(String(value)), config: "motion" },
    busy: { get: (c) => c.isBusy(), set: (c, value) => void c.setBusy(!!value), config: "busy" },
  },
  // The authored opt-out is read before the upgrade builds the component,
  // as the stepper's no-report-validity is
  config: (host: HTMLElement) => ({ busy: !host.hasAttribute("no-busy") }),
  methods: [
    "getVariant",
    "setVariant",
    "getSize",
    "setSize",
    "getLines",
    "setLines",
    "getMotion",
    "setMotion",
    "isBusy",
    "setBusy",
  ] as const,
  events: {},
} satisfies ElementSpec<SkeletonComponent>;

export type SkeletonSpec = typeof skeletonSpec;
export const skeletonElement = defineElement<SkeletonComponent>(skeletonSpec);

/** The skeleton element has no events; the map exists so adapters typecheck. */
export type SkeletonElementEventMap = Record<string, never>;

export const skeletonElementEventNames = [] as const satisfies readonly (keyof SkeletonElementEventMap)[];

export interface SkeletonElement extends HTMLElement {
  component: SkeletonComponent | null;
  variant: string | null;
  size: string | null;
  lines: number | null;
  motion: string | null;
  busy: boolean;
  getVariant: () => SkeletonComponent["getVariant"] extends () => infer V ? V : never;
  setVariant: (variant: string) => SkeletonComponent;
  setSize: (size: string) => SkeletonComponent;
  getLines: () => number;
  setLines: (lines: number) => SkeletonComponent;
  getMotion: () => SkeletonComponent["getMotion"] extends () => infer M ? M : never;
  setMotion: (motion: string) => SkeletonComponent;
  isBusy: () => boolean;
  setBusy: (busy: boolean) => SkeletonComponent;
}

/**
 * Defines `<m-skeleton>` (or the prefixed tag). Client only.
 *
 * @param options - The prefix and any definition options
 * @returns The tag name that was defined
 */
export const defineSkeleton = (options?: DefineOptions): string => skeletonElement.define(options);

declare global {
  /** `document.querySelector("m-…")` and `createElement` return the element's type (the default prefix). */
  interface HTMLElementTagNameMap {
    "m-skeleton": SkeletonElement;
  }
}
