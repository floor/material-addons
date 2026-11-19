"use client";

import { createElement, forwardRef, useCallback, useEffect, useLayoutEffect, useRef, type HTMLAttributes } from "react";
import {
  attributes, changesModel, dispatch, eventKeys, hostProps, initialize, initialValue,
  listen, optionHost, autocompleteHost, synchronize, tag,
  type AutocompleteOptionProps, type AutocompleteEventProps, type AutocompleteProps,
} from "./contract";
import type { AutocompleteElement } from "../../elements/autocomplete";

export type ReactAutocompleteProps = AutocompleteProps & AutocompleteEventProps &
  Omit<HTMLAttributes<AutocompleteElement>, keyof AutocompleteProps | keyof AutocompleteEventProps | "defaultValue">;
export type ReactAutocompleteOptionProps = AutocompleteOptionProps & Omit<HTMLAttributes<HTMLElement>, keyof AutocompleteOptionProps>;

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function createReactAutocomplete() {
  const Autocomplete = forwardRef<AutocompleteElement, ReactAutocompleteProps>(function Autocomplete(props, ref) {
    const element = useRef<AutocompleteElement | null>(null);
    const latest = useRef(props);
    useClientLayoutEffect(() => {
      latest.current = props;
      if (element.current?.component) synchronize(element.current, props);
    });
    useClientLayoutEffect(() => {
      const node = element.current;
      if (!node) return;
      const stop = listen(node, (name, event) => {
        dispatch(latest.current, name, event);
        if (changesModel(name)) queueMicrotask(() => {
          if (element.current === node && node.isConnected) synchronize(node, latest.current);
        });
      });
      initialize(node, latest.current);
      return stop;
    }, []);
    const attach = useCallback((node: AutocompleteElement | null) => {
      element.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    }, [ref]);
    const passthrough = hostProps(autocompleteHost, props, [...eventKeys, "defaultValue", "className", "children"]);
    return createElement(tag("autocomplete"), {
      ...passthrough, ...attributes(autocompleteHost, props, true), class: props.className,
      value: typeof window === "undefined" ? initialValue(props) ?? undefined : undefined,
      ref: attach,
    }, props.children);
  });
  return Autocomplete;
}

export function createReactAutocompleteOption() {
  return forwardRef<HTMLElement, ReactAutocompleteOptionProps>(function AutocompleteOption(props, ref) {
    return createElement(tag("autocomplete-option"), {
      ...hostProps(optionHost, props, ["className", "children"]),
      ...attributes(optionHost, props), class: props.className, ref,
    }, props.children);
  });
}
