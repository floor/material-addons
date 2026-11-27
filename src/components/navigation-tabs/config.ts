import type { NavigationTabsOptions } from "./types";

// Material's public withRipple accepts this shape but does not export its type.
type RippleConfig = { duration?: number };

export interface NavigationTabsConfig extends NavigationTabsOptions {
  /** The existing nav produced by renderNavigationTabs. */
  element: HTMLElement;
  /** Enable Material's press ripple. Defaults to true. */
  ripple?: boolean;
  rippleConfig?: RippleConfig;
}
