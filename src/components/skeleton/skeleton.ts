// src/components/skeleton/skeleton.ts

/**
 * The skeleton primitive: one placeholder shape.
 *
 * Material Design 3 publishes no skeleton component; the placeholder reads
 * the transitions page's direction (a subtle sweep from the reading-order
 * origin toward the far corner) on tone-based surface roles. The wave uses
 * logical directions so RTL starts where reading starts. Everything the
 * spec note fixes is a library default carried by a `--mtrl-skeleton-*`
 * token (skeleton-spec.md, 2026-11-19).
 *
 * The shape is always `aria-hidden`; a standalone skeleton's root is the
 * region and carries `aria-busy` while loading. No events, no focus, no
 * disabled: the skeleton is not a control.
 */

import { SKELETON_CLASSES, SKELETON_DEFAULTS, SKELETON_WAVE_ATTRIBUTE } from "./constants";
import type { SkeletonComponent, SkeletonConfig, SkeletonMotion, SkeletonSize, SkeletonVariant } from "./types";

const variantOf = (value: unknown): SkeletonVariant =>
  value === "circle" || value === "rect" ? value : SKELETON_DEFAULTS.VARIANT;

const sizeOf = (value: unknown): SkeletonSize =>
  value === "small" || value === "large" ? value : SKELETON_DEFAULTS.SIZE;

const motionOf = (value: unknown): SkeletonMotion =>
  value === "pulse" ? "pulse" : SKELETON_DEFAULTS.MOTION;

const linesOf = (value: unknown): number => {
  const lines = Math.floor(Number(value));
  return Number.isFinite(lines) && lines >= 1 ? lines : SKELETON_DEFAULTS.LINES;
};

/**
 * One wave crosses a group: the delay grows with the distance from the
 * group's reading-order origin — the inline-start edge, whichever side that
 * is under the current direction.
 */
const waveDelayOf = (root: HTMLElement, duration: number): number => {
  const parent = (root.closest(`[${SKELETON_WAVE_ATTRIBUTE}]`) as HTMLElement | null) ?? root;
  const parentBox = parent.getBoundingClientRect();
  const box = root.getBoundingClientRect();
  const rtl = getComputedStyle(parent).direction === "rtl";
  const inlineStart = Math.max(rtl ? parentBox.right - box.right : box.left - parentBox.left, 0);
  const blockStart = Math.max(box.top - parentBox.top, 0);
  const distance = parentBox.width + parentBox.height;
  if (!(distance > 0)) return 0;
  return Math.min((duration * (inlineStart + blockStart)) / distance, duration - 1);
};

/**
 * Creates a skeleton placeholder.
 *
 * @param config - Variant, size, lines, motion and the busy flag
 * @returns The skeleton component
 */
const createSkeleton = (config: SkeletonConfig = {}): SkeletonComponent => {
  const root = document.createElement("div");
  root.className = SKELETON_CLASSES.ROOT;
  root.setAttribute("part", "skeleton");

  const shape = document.createElement("span");
  shape.className = SKELETON_CLASSES.SHAPE;
  shape.setAttribute("aria-hidden", "true");
  shape.setAttribute("part", "shape");
  root.appendChild(shape);

  let variant = variantOf(config.variant);
  let size = sizeOf(config.size);
  let lines = linesOf(config.lines);
  let motion = motionOf(config.motion);
  let busy = config.busy !== false;

  if (config.class) root.classList.add(...String(config.class).split(/\s+/).filter(Boolean));

  /** Draws the shape for the current variant and line count. */
  const draw = (): void => {
    root.dataset.variant = variant;
    root.dataset.size = size;
    root.dataset.motion = motion;
    shape.textContent = "";
    if (variant === "text" && lines > 1) {
      for (let index = 0; index < lines; index++) {
        const line = document.createElement("span");
        line.className = SKELETON_CLASSES.LINE;
        line.setAttribute("part", "line");
        shape.appendChild(line);
      }
    }
  };

  /**
   * Reads geometry only after mount, only for the wave, and writes the delay
   * once. A frame after creation the element is in the document wherever its
   * caller appended it; the delay is not re-read on resize.
   */
  const withWave = (): void => {
    if (motion !== "wave" || typeof document === "undefined") return;
    const read = (): void => {
      if (!root.isConnected) return;
      const duration = parseFloat(getComputedStyle(root).getPropertyValue("--mtrl-skeleton-pulse-duration")) || 2000;
      root.style.setProperty("--mtrl-skeleton-delay", `${Math.round(waveDelayOf(root, duration))}ms`);
    };
    const frame = (globalThis as { requestAnimationFrame?: (callback: () => void) => number }).requestAnimationFrame;
    if (frame) frame(() => read());
    else if (root.isConnected) read();
  };

  const applyBusy = (): void => {
    if (busy) root.setAttribute("aria-busy", "true");
    else root.removeAttribute("aria-busy");
  };

  draw();
  applyBusy();

  const component: SkeletonComponent = {
    element: root,
    getVariant: () => variant,
    setVariant(next) {
      variant = variantOf(next);
      draw();
      return component;
    },
    getSize: () => size,
    setSize(next) {
      size = sizeOf(next);
      draw();
      return component;
    },
    getLines: () => lines,
    setLines(next) {
      lines = linesOf(next);
      draw();
      return component;
    },
    getMotion: () => motion,
    setMotion(next) {
      motion = motionOf(next);
      draw();
      return component;
    },
    isBusy: () => busy,
    setBusy(next) {
      busy = next !== false;
      applyBusy();
      return component;
    },
    destroy() {
      root.remove();
    },
  };

  withWave();
  return component;
};

export default createSkeleton;
