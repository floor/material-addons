// src/adapters/solid-breadcrumb.ts

import { mergeProps, onCleanup, onMount, splitProps, type Component, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import {
  attributes, breadcrumbKeys, defineBreadcrumb, hostProps, listenBreadcrumb, synchronizeBreadcrumb, tag,
  type BreadcrumbElementEventMap, type BreadcrumbProps,
} from "./breadcrumb";
import type { BreadcrumbElement } from "../elements/breadcrumb";

type Host = JSX.HTMLAttributes<BreadcrumbElement> & { children?: JSX.Element };
export type SolidBreadcrumbProps = BreadcrumbProps & Omit<Host, keyof BreadcrumbProps | "ref"> & { ref?: (node: BreadcrumbElement) => void };

export function createSolidBreadcrumb(): Component<SolidBreadcrumbProps> {
  return (props) => {
    let element: BreadcrumbElement | undefined;
    onMount(() => {
      defineBreadcrumb();
      const node = element;
      if (!node) return;
      onCleanup(listenBreadcrumb(node, (name, event) => {
        const target = name as keyof BreadcrumbElementEventMap;
        if (target === "beforechange") props.onBeforechange?.(event as never);
        else props.onChange?.(event as never);
      }));
      synchronizeBreadcrumb(node, props);
    });
    const [rest] = splitProps(props, [...breadcrumbKeys, "ref"] as (keyof SolidBreadcrumbProps)[]);
    return Dynamic(mergeProps(rest, hostProps(props, ["onBeforechange", "onChange", "ref"]), attributes(props), {
      component: tag(),
      ref(node: BreadcrumbElement) { element = node; props.ref?.(node); },
    }) as never);
  };
}
