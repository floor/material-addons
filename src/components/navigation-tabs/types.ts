import type { ElementComponent, EventComponent, LifecycleComponent } from "material/core/compose";

export interface NavigationTab {
  href: string;
  label: string;
  /** Trusted, decorative icon markup. */
  icon?: string;
  current?: boolean;
}

export interface NavigationTabsOptions {
  /** Stick at the CSS offset set by --mtrl-navigation-tabs-sticky-offset. */
  sticky?: boolean;
}

export interface NavigationTabsChangeEvent {
  href: string | null;
}

export interface NavigationTabsEvents {
  change: (event: NavigationTabsChangeEvent) => void;
}

export interface NavigationTabsComponent extends ElementComponent, EventComponent<NavigationTabsEvents>, LifecycleComponent {
  /** Returns the current link's authored href. */
  getCurrent(): string | null;
  /** Sets the current link by its authored href, or clears it with null. */
  setCurrent(href: string | null): this;
}
