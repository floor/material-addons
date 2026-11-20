// src/elements/index.ts
/**
 * The element layer: the components as custom elements.
 *
 * Importing registers nothing and touches no DOM, so this module is safe on a
 * server. In the browser, import a component's CSS
 * (`material-addons/elements/css/stepper`), then call its `define*` function.
 *
 * @module elements
 */

export { breadcrumbElement, breadcrumbItemDeclaration, defineBreadcrumb } from "./breadcrumb";
export type { BreadcrumbElement, BreadcrumbItemElement, BreadcrumbSpec } from "./breadcrumb";

export { skeletonElement, defineSkeleton, skeletonElementEventNames } from "./skeleton";
export type { SkeletonElement, SkeletonElementEventMap, SkeletonSpec } from "./skeleton";

export { stepperElement, stepDeclaration, defineStepper, stepperElementEventNames } from "./stepper";
export type { StepperElement, StepAttributes, StepperElementEventMap } from "./stepper";
export {
  expansionPanelElement, accordionElement, expansionPanelEventNames, defineExpansionPanel,
} from "./expansion-panel";
export type {
  AccordionElement, ExpansionPanelElement, ExpansionPanelElementEventMap,
} from "./expansion-panel";

export { avatarElement, defineAvatar } from "./avatar";
export type { AvatarElement, AvatarElementEventMap } from "./avatar";
