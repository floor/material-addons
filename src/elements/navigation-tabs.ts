import { defineElement, type ElementInstance, type ElementSpec } from "material/elements";
import { createNavigationTabs, type NavigationTabsChangeEvent, type NavigationTabsComponent } from "../components/navigation-tabs";
import { CURRENT_ATTRIBUTE, NAVIGATION_TABS_CLASSES as classes } from "../components/navigation-tabs/constants";

const authoredLinks = (host: HTMLElement): HTMLAnchorElement[] =>
  Array.from(host.children).filter((child): child is HTMLAnchorElement =>
    child.localName === "a" && child.hasAttribute("href"));
const authoredCurrent = (host: HTMLElement): string | null =>
  authoredLinks(host).find(link => link.getAttribute(CURRENT_ATTRIBUTE) === "page")?.getAttribute("href") ?? null;
const signatures = new WeakMap<HTMLElement, string>();
const signature = (links: HTMLAnchorElement[]): string => links.map(link => link.outerHTML).join("");

function createNav(host: HTMLElement): HTMLElement {
  const doc = host.ownerDocument;
  const nav = doc.createElement("nav");
  nav.className = classes.ROOT;
  const label = host.getAttribute("aria-label");
  if (label !== null) nav.setAttribute("aria-label", label);
  const links = authoredLinks(host);
  signatures.set(host, signature(links));

  for (const source of links) {
    const link = source.cloneNode(true) as HTMLAnchorElement;
    link.classList.add(classes.TAB);
    const indicator = doc.createElement("span");
    indicator.className = classes.INDICATOR;
    indicator.setAttribute("aria-hidden", "true");
    const text = doc.createElement("span");
    text.className = classes.LABEL;
    const svg = Array.from(link.children).find(child => child.localName === "svg");
    if (svg) {
      const icon = doc.createElement("span");
      icon.className = classes.ICON;
      icon.setAttribute("aria-hidden", "true");
      icon.append(svg);
      text.append(...Array.from(link.childNodes));
      link.append(indicator, icon, text);
    } else {
      text.append(...Array.from(link.childNodes));
      link.append(indicator, text);
    }
    nav.append(link);
  }
  return nav;
}

const spec = {
  name: "navigation-tabs",
  ssr: false,
  styles: ["navigation-tabs"],
  hostStyles: ":host{display:block}:host([sticky]){position:sticky;inset-block-start:var(--mtrl-navigation-tabs-sticky-offset,0px);z-index:var(--mtrl-navigation-tabs-sticky-z-index,1)}",
  create: (config: Record<string, unknown>) => {
    const component = createNavigationTabs({
      element: config.element as HTMLElement,
      ripple: config.ripple === true,
    });
    component.setCurrent(config.current as string | null);
    return component;
  },
  config: (host: HTMLElement) => ({
    element: createNav(host),
    ripple: !host.hasAttribute("no-ripple"),
    current: host.getAttribute("current") ?? authoredCurrent(host),
  }),
  attributes: {
    "aria-label": {
      type: "string",
      update: (component: NavigationTabsComponent, label: unknown) => {
        if (typeof label === "string") component.element.setAttribute("aria-label", label);
        else component.element.removeAttribute("aria-label");
      },
    },
    sticky: { type: "boolean", update: () => {} },
    "no-ripple": { type: "boolean" },
    current: {
      type: "string",
      update: (component: NavigationTabsComponent, href: unknown, host: HTMLElement) => {
        component.setCurrent(typeof href === "string" ? href : authoredCurrent(host));
      },
    },
  },
  methods: ["getCurrent", "setCurrent"] as const,
  events: { change: { detail: (payload: unknown) => payload as NavigationTabsChangeEvent } },
  observeChildren: (host: HTMLElement) => signature(authoredLinks(host)) === signatures.get(host),
} satisfies ElementSpec<NavigationTabsComponent>;

export const navigationTabsElement = defineElement<NavigationTabsComponent>(spec);
export const defineNavigationTabs = navigationTabsElement.define;
export type NavigationTabsSpec = typeof spec;
export type NavigationTabsElement = ElementInstance<NavigationTabsSpec, NavigationTabsComponent>;
export type NavigationTabsElementEventMap = { change: CustomEvent<NavigationTabsChangeEvent> };

declare global {
  interface HTMLElementTagNameMap {
    "m-navigation-tabs": NavigationTabsElement;
  }
}
