import { createBase, withEvents, withLifecycle, withRipple } from "material/core/compose";
import type { NavigationTabsConfig } from "./config";
import { CURRENT_ATTRIBUTE, NAVIGATION_TABS_CLASSES as classes } from "./constants";
import type { NavigationTabsComponent, NavigationTabsEvents } from "./types";

const instances = new WeakMap<HTMLElement, NavigationTabsComponent>();

/** Adds the press ripple and current-page API to an existing nav. */
export function createNavigationTabs({ element, ripple = true, rippleConfig, sticky }: NavigationTabsConfig): NavigationTabsComponent {
  const existing = instances.get(element);
  if (existing) return existing;
  if (sticky !== undefined) element.classList.toggle(classes.STICKY, sticky);

  const base = createBase({ componentName: "navigation-tabs" });
  const links = (): HTMLAnchorElement[] =>
    Array.from(element.children).filter((child): child is HTMLAnchorElement =>
      child.localName === "a" && child.classList.contains(classes.TAB) && child.hasAttribute("href"));
  const current = (): HTMLAnchorElement | undefined =>
    links().find(link => link.getAttribute(CURRENT_ATTRIBUTE) === "page");
  const ripples = ripple ? links().map(link => {
    const { ripple } = withRipple({ ripple: true, rippleConfig })({
      ...base,
      element: link,
      addClass(...names: string[]) { link.classList.add(...names); return this; },
      destroy() {},
    });
    return () => ripple.unmount(link);
  }) : [];

  const component = withLifecycle()(withEvents<NavigationTabsEvents>()({
    ...base,
    element,
    addClass(...names: string[]) { element.classList.add(...names); return this; },
    destroy() {
      for (const unmount of ripples) unmount();
      instances.delete(element);
    },
  }));

  const api: NavigationTabsComponent = {
    ...component,
    addClass(...names) { element.classList.add(...names); return this; },
    on(event, handler) { component.on(event, handler); return this; },
    off(event, handler) { component.off(event, handler); return this; },
    emit(event, data) { component.emit(event, data); return this; },
    getCurrent: () => current()?.getAttribute("href") ?? null,
    setCurrent(href) {
      const tabs = links();
      const next = href === null ? undefined : tabs.find(link => link.getAttribute("href") === href);
      if (href !== null && !next) return this;
      const previous = current();
      for (const link of tabs) {
        if (link === next) link.setAttribute(CURRENT_ATTRIBUTE, "page");
        else link.removeAttribute(CURRENT_ATTRIBUTE);
      }
      if (next !== previous) component.emit("change", { href });
      return this;
    },
    destroy: component.lifecycle.destroy,
  };
  instances.set(element, api);
  return api;
}

export default createNavigationTabs;
