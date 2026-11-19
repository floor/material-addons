/**
 * @module core/layout/schema
 * @description Unified layout schema processor with integrated optimizations
 * Consolidates array, object, JSX, and template processing with built-in performance enhancements
 */

// ============================================================================
// TYPES (Essential only)
// ============================================================================

export interface LayoutConfig {
  /** Base layout type */
  type?: "stack" | "row" | "grid" | string;
  /** Spacing between elements */
  gap?: number | string;
  /** Additional CSS classes */
  class?: string;
  /** Alignment of items along the cross axis */
  align?: "start" | "center" | "end" | "stretch";
  /** Alignment of items along the main axis */
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  /** Whether and how items should wrap */
  wrap?: boolean | "reverse" | "nowrap";
  /** Whether row items should stack vertically on mobile */
  mobileStack?: boolean;
  /** Whether row items should scroll horizontally on mobile */
  mobileScroll?: boolean;
  /** Number of columns or automatic sizing method */
  columns?: number | "auto-fit" | "auto-fill";
  /** Whether to use dense packing algorithm for grid */
  dense?: boolean;
  /** Whether grid items should adjust height automatically */
  autoHeight?: boolean;
}

export interface LayoutItemConfig {
  /** Column width in a 12-column grid */
  width?: number;
  /** Width on small screens */
  sm?: number;
  /** Width on medium screens */
  md?: number;
  /** Width on large screens */
  lg?: number;
  /** Width on extra-large screens */
  xl?: number;
  /** Number of grid columns to span */
  span?: number;
  /** Number of grid rows to span */
  rowSpan?: number;
  /** Display order */
  order?: number | "first" | "last";
  /** Self-alignment within container */
  align?: "start" | "center" | "end" | "stretch";
  /** Whether item should automatically size */
  auto?: boolean;
}

export interface LayoutOptions {
  /** Default creator function to use if not specified in schema */
  creator?: Function;
  /**
   * Render the layout's component leaves as skeleton placeholders instead of
   * calling their creators. The layout itself (stack, row, grid) stays real;
   * `reveal()` on the result swaps the real components in without moving the
   * layout classes. Default false.
   */
  skeleton?: boolean;
  /**
   * @deprecated No effect: a layout item's classes (class, className and the
   * deprecated rawClass) are applied as written. Kept so existing code keeps
   * compiling.
   */
  prefix?: boolean;
  /** Additional options */
  [key: string]: any;
}

export interface LayoutResult {
  /** The raw layout object with all components */
  layout: Record<string, any>;
  /** Reference to the root element for convenience */
  element: HTMLElement | any;
  /** Flattened component map */
  component: Record<string, any>;
  /** Gets a component by name */
  get(name: string): any;
  /** Gets all components in a flattened map */
  getAll(): Record<string, any>;
  /** Destroys the layout, cleaning up all components */
  destroy(): void;
  /**
   * Swaps every skeleton placeholder for its real component, in the same
   * host, then clears the region's `aria-busy`. A layout that was not built
   * with `skeleton: true` has nothing to reveal; calling it is a no-op.
   */
  reveal(): void;
}

type ComponentLike = { element: HTMLElement; [key: string]: any };
type SchemaItem = Function | string | Record<string, any> | SchemaItem[];

// ============================================================================
// BUILT-IN OPTIMIZATIONS
// ============================================================================

/**
 * Fragment Pool for efficient DocumentFragment reuse
 * Reduces GC pressure in high-frequency layout creation scenarios
 */
class FragmentPool {
  private pool: DocumentFragment[] = [];
  private maxSize = 8; // Optimized size for memory efficiency

  get(): DocumentFragment {
    return this.pool.pop() || document.createDocumentFragment();
  }

  release(fragment: DocumentFragment): void {
    if (this.pool.length < this.maxSize && fragment.childNodes.length === 0) {
      this.pool.push(fragment);
    }
  }

  clear(): void {
    this.pool.length = 0;
  }
}

const fragmentPool = new FragmentPool();

/**
 * Class name cache for layout configurations
 * Reduces string operations by caching generated class names
 */
const classCache = new Map<string, string>();

// Configuration constants
import { createSkeleton, skeletonFor } from "../../components/skeleton";

const PREFIX = "mtrl"; // TODO: Make this configurable
const PREFIX_WITH_DASH = `${PREFIX}-`;

/**
 * Gets a cached class name for layout configuration
 * Optimized for different class naming patterns
 */
function getCachedClassName(
  type: string,
  property: string,
  value: string | number,
): string {
  const key = `${type}-${property}-${value}`;
  if (!classCache.has(key)) {
    if (type === "item") {
      classCache.set(
        key,
        property === ""
          ? `layout__item--${value}`
          : `layout__item--${property}-${value}`,
      );
    } else {
      // For layout classes, align uses layout--{type}-{value}
      // but justify and others use layout--{type}-{property}-{value}
      if (property === "align") {
        classCache.set(key, `layout--${type}-${value}`);
      } else {
        classCache.set(key, `layout--${type}-${property}-${value}`);
      }
    }
  }
  return classCache.get(key)!;
}

// ============================================================================
// OPTIMIZED UTILITIES
// ============================================================================

/**
 * Checks if a value is a component object (has an element property)
 */
function isComponent(value: any): value is ComponentLike {
  return value && typeof value === "object" && "element" in value;
}

/**
 * Creates a document fragment using pooling for better performance
 */
function createFragment(): DocumentFragment {
  return fragmentPool.get();
}

/**
 * Releases a fragment back to the pool for reuse
 */
function releaseFragment(fragment: DocumentFragment): void {
  fragmentPool.release(fragment);
}

/**
 * Merges a layout item's class options into one `class` string, as written:
 * `className` is an alias of `class`, and the deprecated `rawClass` follows
 * it. Nothing is prefixed — material's createElement receives the classes
 * verbatim, and so does the layout.
 * @param skipPrefix - No longer used: the classes are always applied as
 *   written. The parameter is kept so existing callers keep compiling.
 */
function processClassNames(
  options: Record<string, any>,
  skipPrefix = false,
): Record<string, any> {
  if (!options) return options;

  const hasRawClass = options.rawClass;
  const hasRegularClass = options.class || options.className;

  // Fast path: no class properties at all
  if (!hasRawClass && !hasRegularClass) return options;

  const processed = { ...options };
  const classes: string[] = [];

  if (processed.class) {
    classes.push(
      Array.isArray(processed.class)
        ? processed.class.filter(Boolean).join(" ")
        : processed.class,
    );
  }
  if (processed.className) {
    classes.push(
      Array.isArray(processed.className)
        ? processed.className.filter(Boolean).join(" ")
        : processed.className,
    );
  }
  if (hasRawClass) {
    classes.push(
      Array.isArray(hasRawClass)
        ? hasRawClass.filter(Boolean).join(" ")
        : hasRawClass,
    );
  }

  const finalClasses = classes.filter(Boolean).join(" ");
  if (finalClasses) {
    processed.class = finalClasses;
  }

  // Clean up in one operation
  delete processed.className;
  delete processed.rawClass;

  return processed;
}

/**
 * Optimized parameter extraction for array schemas
 * Reduces multiple array lookups with batch processing
 */
interface ExtractedParameters {
  creator: Function;
  name?: string;
  options: Record<string, any>;
  consumed: number;
}

function extractParameters(
  schema: SchemaItem[],
  startIndex: number,
  defaultCreator: Function,
): ExtractedParameters {
  const items = schema.slice(startIndex, startIndex + 3);
  let creator, name, options;
  let consumed = 1;

  const [first, second, third] = items;

  if (typeof first === "function") {
    creator = first;
    if (typeof second === "string") {
      name = second;
      consumed = 2;
      if (isObject(third)) {
        options = third;
        consumed = 3;
      }
    } else if (isObject(second)) {
      options = second;
      consumed = 2;
    }
  } else if (typeof first === "string") {
    creator = defaultCreator;
    name = first;
    if (isObject(second)) {
      options = second;
      consumed = 2;
    }
  } else if (isObject(first)) {
    creator = defaultCreator;
    options = first;
  }

  return {
    creator: creator || defaultCreator,
    name,
    options: (options || {}) as Record<string, any>,
    consumed,
  };
}

/**
 * Simple object type check
 */
function isObject(value: any): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// ============================================================================
// DOM UTILITIES (Simplified)
// ============================================================================

/**
 * Simple DOM element creation
 */
function createElement(options: Record<string, any> = {}): HTMLElement {
  const tag = options.tag || "div";
  const element = document.createElement(tag);

  if (options.class) {
    element.className = options.class;
  }

  if (options.style) {
    if (typeof options.style === "string") {
      element.setAttribute("style", options.style);
    } else if (typeof options.style === "object") {
      Object.assign(element.style, options.style);
    }
  }

  if (options.textContent) {
    element.textContent = options.textContent;
  }

  if (options.text) {
    element.textContent = options.text;
  }

  return element;
}

/**
 * Adds a CSS class to an element
 */
function addClass(element: HTMLElement, className: string): void {
  if (element && className) {
    element.classList.add(className);
  }
}

/**
 * Checks if element has a CSS class
 */
function hasClass(element: HTMLElement, className: string): boolean {
  return element && element.classList.contains(className);
}

// ============================================================================
// UNIFIED COMPONENT CREATION (with destructuring optimization)
// ============================================================================

/**
 * A component leaf stood in as its mapped skeleton placeholder.
 *
 * A host div takes the layout classes the real element would have taken and
 * the mapped placeholder fills it; `reveal()` later creates the real
 * component with the original options (minus the layout classes, which stay
 * on the host) and replaces the placeholder in the same turn. The layout's
 * region carries `aria-busy`; the placeholder inside it does not. Used by
 * the schema processor's creator path and by JSX's `h()` alike.
 */
export function createSkeletonHost(
  Component: Function,
  options: Record<string, any> = {},
): { element: HTMLElement; reveal: () => any; destroy: () => void } {
  const { layout: layoutConfig, layoutItem: layoutItemConfig, ...skeletonOptions } = options;
  const host = document.createElement("div");
  host.className = "mtrl-skeleton-host";
  if (layoutConfig) applyLayoutClasses(host, layoutConfig);
  if (layoutItemConfig) applyLayoutItemClasses(host, layoutItemConfig);
  const mapped = skeletonFor(Component, skeletonOptions);
  // The mapping's sizes are the host's: the host is the layout's item, so a
  // mapped inlineSize or blockSize takes the layout's box rather than an
  // even split, and the placeholder fills that box.
  if (mapped.inlineSize) {
    host.style.width = mapped.inlineSize;
    // The mapping owns this box: a row's growing items would otherwise
    // redistribute it into an even split. The flex behaviour is the host's
    // for its whole life — it is never switched at reveal, so a matched
    // mapping cannot move anything by changing how the container shares
    // space between the two phases.
    host.style.flex = "none";
  }
  if (mapped.blockSize) host.style.height = mapped.blockSize;
  const placeholder = createSkeleton({ ...mapped, busy: false });
  host.appendChild(placeholder.element);
  // The component slot: until reveal it is the placeholder's host, and every
  // holder of this object — a layout's component map, a form's field
  // registry — sees the placeholder. reveal() swaps the real component in
  // and forwards this object to it, so those same holders see the real
  // component's element and API from then on, with nothing re-registered.
  const slot: { element: HTMLElement; reveal: () => any; destroy: () => void; [key: string]: any } = {
    element: host,
    reveal(): any {
      const { layout: _layout, layoutItem: _layoutItem, ...revealOptions } = options;
      const real = createComponentInstance(Component, revealOptions);
      if (real && real.element) {
        // The mapping's placeholder box is replaced by the real component's
        // measured box, measured after the swap when the real element is in
        // the document. The host always carries an explicit inline size and
        // one flex behaviour, so no container — flex, grid, stack — can
        // reinterpret the item between the two phases: a matched mapping
        // writes the same numbers and nothing moves; a mismatch reflows
        // once, to the real component's own size, covering nothing.
        host.replaceChild(real.element, placeholder.element);
        const realBox = (real.element as HTMLElement);
        const realWidth = realBox.offsetWidth;
        if (realWidth > 0) host.style.width = `${realWidth}px`;
        const realHeight = realBox.offsetHeight;
        if (realHeight > 0) host.style.height = `${realHeight}px`;
        placeholder.destroy();
        for (const key of Object.keys(real)) {
          if (key !== "destroy") slot[key] = (real as Record<string, unknown>)[key];
        }
        slot.element = real.element as HTMLElement;
        if (typeof real.destroy === "function") {
          const destroyReal = real.destroy.bind(real);
          slot.destroy = (): void => {
            destroyReal();
            host.remove();
          };
        }
      }
      return real;
    },
    destroy(): void {
      placeholder.destroy();
      host.remove();
    },
  };
  return slot;
}

/**
 * Creates a component instance with optimized option processing
 * Uses destructuring for cleaner separation of concerns
 */
function createComponentInstance(
  Component: any,
  options: Record<string, any> = {},
  skeleton: boolean = false,
): any {
  // The skeleton branch: the component's creator is not called. The internal
  // element creator is not a skeleton: its plain divs are the layout itself.
  if (skeleton && typeof Component === "function" && Component !== createElement) {
    return createSkeletonHost(Component, options);
  }

  try {
    // Destructure special configs in one operation
    const {
      layout: layoutConfig,
      layoutItem: layoutItemConfig,
      style: styleConfig,
      attributes: attributesConfig,
      events: eventsConfig,
      event, // Legacy support
      ...cleanOptions
    } = options;

    // Use events over event (events is preferred)
    const finalEventsConfig = eventsConfig || event;

    // If style is a string, always pass it through to the component
    if (styleConfig && typeof styleConfig === "string") {
      cleanOptions.style = styleConfig;
    }

    // Create component
    const isClass =
      typeof Component === "function" &&
      Object.getOwnPropertyDescriptor(Component, "prototype")?.writable ===
        false;

    const component = isClass
      ? new Component(cleanOptions)
      : Component(cleanOptions);

    // Apply configurations if component has element
    if (component) {
      const element =
        component.element ||
        (component instanceof HTMLElement ? component : null);
      if (element) {
        // Apply layout classes
        if (layoutConfig) applyLayoutClasses(element, layoutConfig);

        // Apply layout item classes
        if (layoutItemConfig) applyLayoutItemClasses(element, layoutItemConfig);

        // Apply style
        if (styleConfig && typeof styleConfig === "object") {
          Object.assign(element.style, styleConfig);
        }

        // Apply attributes
        if (attributesConfig && typeof attributesConfig === "object") {
          for (const [key, value] of Object.entries(attributesConfig)) {
            if (value !== undefined && value !== null) {
              element.setAttribute(key, value.toString());
            }
          }
        }

        // Apply events
        if (finalEventsConfig && typeof finalEventsConfig === "object") {
          if (Array.isArray(finalEventsConfig)) {
            for (const eventDef of finalEventsConfig) {
              if (Array.isArray(eventDef) && eventDef.length >= 2) {
                const [eventName, handler] = eventDef;
                if (
                  typeof eventName === "string" &&
                  typeof handler === "function"
                ) {
                  element.addEventListener(eventName, handler);
                }
              }
            }
          } else {
            for (const [eventName, handler] of Object.entries(
              finalEventsConfig,
            )) {
              if (typeof handler === "function") {
                element.addEventListener(eventName, handler);
              }
            }
          }
        }
      }
    }

    return component;
  } catch (error) {
    console.error("Error creating component instance:", error);
    return document.createElement("div");
  }
}

// ============================================================================
// INTEGRATED LAYOUT CONFIGURATION (with caching)
// ============================================================================

/**
 * Applies layout classes based on configuration
 * Uses integrated caching for optimal performance
 */
function applyLayoutClasses(
  element: HTMLElement,
  layoutConfig: LayoutConfig,
): void {
  if (!element || !layoutConfig) return;

  // Apply base layout type
  if (layoutConfig.type) {
    addClass(element, `${PREFIX_WITH_DASH}layout--${layoutConfig.type}`);
  }

  // Apply properties with caching
  const layoutType = layoutConfig.type || getLayoutType(element);
  if (layoutType) {
    if (layoutConfig.gap !== undefined) {
      addClass(
        element,
        PREFIX_WITH_DASH +
          getCachedClassName(layoutType, "gap", layoutConfig.gap),
      );
    }
    if (layoutConfig.align) {
      addClass(
        element,
        PREFIX_WITH_DASH +
          getCachedClassName(layoutType, "align", layoutConfig.align),
      );
    }
    if (layoutConfig.justify) {
      addClass(
        element,
        PREFIX_WITH_DASH +
          getCachedClassName(layoutType, "justify", layoutConfig.justify),
      );
    }
  }

  // Grid-specific properties
  if (layoutConfig.type === "grid" || getLayoutType(element) === "grid") {
    if (typeof layoutConfig.columns === "number") {
      addClass(
        element,
        PREFIX_WITH_DASH +
          getCachedClassName("grid", "cols", layoutConfig.columns),
      );
    } else if (layoutConfig.columns === "auto-fill") {
      addClass(
        element,
        PREFIX_WITH_DASH + getCachedClassName("grid", "fill", "auto"),
      );
    } else if (layoutConfig.columns === "auto-fit") {
      addClass(
        element,
        PREFIX_WITH_DASH + getCachedClassName("grid", "cols", "auto-fit"),
      );
    }
    if (layoutConfig.dense)
      addClass(element, `${PREFIX_WITH_DASH}layout--grid-dense`);
    if (layoutConfig.autoHeight)
      addClass(element, `${PREFIX_WITH_DASH}layout--grid-auto-height`);
  }

  // Row-specific properties
  if (layoutConfig.type === "row" || getLayoutType(element) === "row") {
    if (layoutConfig.wrap === false || layoutConfig.wrap === "nowrap") {
      addClass(element, `${PREFIX_WITH_DASH}layout--row-nowrap`);
    } else if (layoutConfig.wrap === "reverse") {
      addClass(element, `${PREFIX_WITH_DASH}layout--row-wrap-reverse`);
    }
    if (layoutConfig.mobileStack)
      addClass(element, `${PREFIX_WITH_DASH}layout--row-mobile-stack`);
    if (layoutConfig.mobileScroll)
      addClass(element, `${PREFIX_WITH_DASH}layout--row-mobile-scroll`);
  }

  // Custom classes
  if (layoutConfig.class) {
    layoutConfig.class
      .split(" ")
      .filter(Boolean)
      .forEach((cls) => element.classList.add(cls));
  }
}

/**
 * Applies layout item classes based on configuration
 * Uses integrated caching for optimal performance
 */
function applyLayoutItemClasses(
  element: HTMLElement,
  itemConfig: LayoutItemConfig,
): void {
  if (!element || !itemConfig) return;

  addClass(element, `${PREFIX_WITH_DASH}layout__item`);

  // Width and responsive classes with caching
  if (itemConfig.width && itemConfig.width >= 1 && itemConfig.width <= 12) {
    addClass(
      element,
      PREFIX_WITH_DASH + getCachedClassName("item", "", itemConfig.width),
    );
  }
  if (itemConfig.sm)
    addClass(
      element,
      PREFIX_WITH_DASH + getCachedClassName("item", "sm", itemConfig.sm),
    );
  if (itemConfig.md)
    addClass(
      element,
      PREFIX_WITH_DASH + getCachedClassName("item", "md", itemConfig.md),
    );
  if (itemConfig.lg)
    addClass(
      element,
      PREFIX_WITH_DASH + getCachedClassName("item", "lg", itemConfig.lg),
    );
  if (itemConfig.xl)
    addClass(
      element,
      PREFIX_WITH_DASH + getCachedClassName("item", "xl", itemConfig.xl),
    );

  // Grid span classes
  if (itemConfig.span)
    addClass(
      element,
      PREFIX_WITH_DASH + getCachedClassName("item", "span", itemConfig.span),
    );
  if (itemConfig.rowSpan)
    addClass(
      element,
      PREFIX_WITH_DASH +
        getCachedClassName("item", "row-span", itemConfig.rowSpan),
    );

  // Order and alignment
  if (itemConfig.order)
    addClass(
      element,
      PREFIX_WITH_DASH + getCachedClassName("item", "order", itemConfig.order),
    );
  if (itemConfig.align)
    addClass(
      element,
      PREFIX_WITH_DASH + getCachedClassName("item", "self", itemConfig.align),
    );
  if (itemConfig.auto)
    addClass(element, `${PREFIX_WITH_DASH}layout__item--auto`);
}

/**
 * Gets the layout type from element classes
 */
function getLayoutType(element: HTMLElement): string {
  return hasClass(element, `${PREFIX_WITH_DASH}layout--stack`)
    ? "stack"
    : hasClass(element, `${PREFIX_WITH_DASH}layout--row`)
      ? "row"
      : hasClass(element, `${PREFIX_WITH_DASH}layout--grid`)
        ? "grid"
        : "";
}

// ============================================================================
// UNIFIED SCHEMA PROCESSORS
// ============================================================================

/**
 * Processes array-based schema definitions
 * Optimized with parameter extraction and integrated configuration
 */
function processArraySchema(
  schema: SchemaItem[] | any,
  parentElement: HTMLElement | null = null,
  level: number = 0,
  options: LayoutOptions = {},
): LayoutResult {
  level++;
  const layout: Record<string, any> = {};
  const components: Array<[string, any]> = [];
  const fragment = createFragment();
  let component = null;

  if (!Array.isArray(schema)) {
    return createLayoutResult(layout);
  }

  const defaultCreator = (options as any).creator || createElement;

  for (let i = 0; i < schema.length; i++) {
    const item = schema[i];
    if (!item) continue;

    // Handle nested arrays
    if (Array.isArray(item)) {
      const container = component || parentElement;
      const result = processArraySchema(item, container, level, options);
      // Merge nested components array instead of overwriting
      if (Array.isArray(result.layout.components)) {
        components.push(...result.layout.components);
        delete result.layout.components;
      }
      Object.assign(layout, result.layout);
      continue;
    }

    // Use optimized parameter extraction
    const {
      creator,
      name,
      options: itemOptions,
      consumed,
    } = extractParameters(schema, i, defaultCreator);

    if (!creator) {
      console.warn("Skipping unsupported item type:", item);
      continue;
    }

    // Default to div for createElement
    if (creator === createElement && !("tag" in itemOptions)) {
      itemOptions.tag = "div";
    }

    // Advance index by consumed items minus 1 (loop increment handles the +1)
    i += consumed - 1;

    // A layout item's classes are applied as written: merge class, className
    // and the deprecated rawClass; no prefix is involved.
    const processedOptions = processClassNames(itemOptions);

    // Add name to options if needed
    if (
      name &&
      !("name" in processedOptions) &&
      !(creator === createElement || (creator as any).isElement)
    ) {
      processedOptions.name = name;
    }

    // Create component
    component = createComponentInstance(creator, processedOptions, options.skeleton === true);
    const element = isComponent(component) ? component.element : component;

    if (level === 1) layout.element = element;
    if (name) {
      layout[name] = component;
      components.push([name, component]);
    }

    // Append to DOM
    if (component) {
      if ("insert" in component && typeof component.insert === "function") {
        component.insert(fragment);
      } else {
        fragment.appendChild(element);
      }

      if (parentElement) {
        component._container = parentElement;
        if (
          "onInserted" in component &&
          typeof component.onInserted === "function"
        ) {
          component.onInserted(parentElement);
        }
      }
    }
  }

  // Append fragment to parent
  if (parentElement && fragment.hasChildNodes()) {
    const wrapper = isComponent(parentElement)
      ? parentElement.element
      : parentElement;
    wrapper.appendChild(fragment);
  }

  // Release fragment back to pool
  releaseFragment(fragment);

  layout.components = components;
  return createLayoutResult(layout);
}

/**
 * Processes object-based schema definitions
 * Simplified and optimized for better performance
 */
function processObjectSchema(
  schema: Record<string, any> | string,
  parentElement: HTMLElement | null = null,
  options: LayoutOptions = {},
): LayoutResult {
  const layout: Record<string, any> = {};
  const defaultCreator = options.creator || createElement;

  // Handle root element creation
  if ((schema as any).element && !parentElement) {
    const elementDef = (schema as any).element;
    const createElementFn = elementDef.creator || defaultCreator;

    const elementOptions = elementDef.options || {};
    const processedOptions = processClassNames(elementOptions);

    const rootComponent = createComponentInstance(
      createElementFn,
      processedOptions,
      options.skeleton === true,
    );

    layout.element = rootComponent;
    if (elementDef.name) layout[elementDef.name] = rootComponent;

    // Process children
    if (elementDef.children) {
      const rootElement = isComponent(rootComponent)
        ? rootComponent.element
        : rootComponent;
      const childResult = processObjectSchema(
        elementDef.children,
        rootElement,
        options,
      );
      Object.assign(layout, childResult.layout);
    }

    return createLayoutResult(layout);
  }

  // Process normal schema elements
  const fragment = parentElement ? createFragment() : null;

  for (const key in schema as Record<string, any>) {
    const def = (schema as Record<string, any>)[key];
    if (!def) continue;

    const elementCreator = def.creator || defaultCreator;
    const elementOptions = def.options || {};
    const processedOptions = processClassNames(elementOptions);

    if (!def.name && key !== "element") {
      def.name = key;
    }

    const created = createComponentInstance(elementCreator, processedOptions, options.skeleton === true);
    layout[key] = created;
    if (def.name && def.name !== key) layout[def.name] = created;

    const element = isComponent(created) ? created.element : created;
    if (fragment) fragment.appendChild(element);

    // Process children
    if (def.children) {
      const childResult = processObjectSchema(def.children, element, options);
      Object.assign(layout, childResult.layout);
    }
  }

  // Append to parent
  if (parentElement && fragment) {
    const parentDom = isComponent(parentElement)
      ? parentElement.element
      : parentElement;
    parentDom.appendChild(fragment);
    releaseFragment(fragment);
  }

  return createLayoutResult(layout);
}

// ============================================================================
// LAYOUT RESULT CREATION
// ============================================================================

/**
 * Flattens a nested layout into a simple object with element and component references
 */
function flattenLayout(layout: Record<string, any>): Record<string, any> {
  const flattened: Record<string, any> = {};

  if (!layout || typeof layout !== "object") return flattened;

  for (const key in layout) {
    const value = layout[key];
    if (
      value &&
      typeof value !== "function" &&
      (value instanceof HTMLElement ||
        (typeof SVGElement !== "undefined" && value instanceof SVGElement) ||
        isComponent(value))
    ) {
      flattened[key] = value;
    }
  }

  return flattened;
}

/**
 * Creates a layout result object with utility functions
 */
function createLayoutResult(layout: Record<string, any>): LayoutResult {
  const flattenedComponents = flattenLayout(layout);

  return {
    layout,
    element: layout.element,
    component: flattenedComponents,

    get(name: string): any {
      return layout[name] ?? null;
    },

    getAll(): Record<string, any> {
      return flattenedComponents;
    },

    reveal(): void {
      for (const component of Object.values(flattenedComponents)) {
        if (
          component &&
          typeof component === "object" &&
          typeof (component as any).reveal === "function"
        ) {
          (component as any).reveal();
        }
      }
      const region = isComponent(layout.element) ? layout.element.element : layout.element;
      if (region && typeof region.removeAttribute === "function") {
        region.removeAttribute("aria-busy");
      }
    },

    destroy(): void {
      // Track destroyed components to avoid double-destroy
      const destroyed = new Set<any>();

      // Helper to safely destroy a component
      const destroyComponent = (component: any): void => {
        if (!component || destroyed.has(component)) return;

        // Skip plain HTML elements and non-objects
        if (component instanceof HTMLElement || typeof component !== "object")
          return;

        // Check if it's a component with destroy method
        if (typeof component.destroy === "function") {
          destroyed.add(component);
          try {
            component.destroy();
          } catch (e) {
            // Ignore destroy errors - component may already be cleaned up
          }
        }
      };

      // First destroy components from the components array (if present)
      // This ensures all named components are destroyed even if nested
      if (Array.isArray(layout.components)) {
        for (const [name, component] of layout.components) {
          destroyComponent(component);
        }
      }

      // Then iterate over all layout keys for any missed components
      for (const key in layout) {
        if (key === "element" || key === "components") continue;
        destroyComponent(layout[key]);
      }

      // Clear the components array
      if (Array.isArray(layout.components)) {
        layout.components.length = 0;
      }

      // Remove root element from DOM
      if (layout.element) {
        const element = isComponent(layout.element)
          ? layout.element.element
          : layout.element;
        if (element && element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }

      // Clear references to help GC
      for (const key in layout) {
        delete layout[key];
      }
    },
  };
}

// ============================================================================
// UNIFIED ENTRY POINT
// ============================================================================

/**
 * Creates a layout from various schema formats
 * Unified processor for arrays, objects, JSX, and HTML strings
 */
export function createLayout(
  schema: any,
  parentElement: HTMLElement | null = null,
  options: LayoutOptions = {},
): LayoutResult {
  // Handle function schemas
  if (typeof schema === "function") {
    schema = schema();
  }

  // Handle HTML string schemas
  if (typeof schema === "string") {
    const template = document.createElement("template");
    template.innerHTML = schema.trim();
    const fragment = template.content;

    if (parentElement && fragment.hasChildNodes()) {
      parentElement.appendChild(fragment);
    }

    const layout = { element: fragment.firstElementChild as HTMLElement };
    return createLayoutResult(layout);
  }

  // Route to appropriate processor; the JSX-like array (function, string,
  // object) is the array processor's own triple form, not a separate path
  const result = Array.isArray(schema)
    ? processArraySchema(schema, parentElement, 0, options)
    : processObjectSchema(schema, parentElement, options);

  if (options.skeleton === true) {
    // The region is the layout root: the parent this layout was built into,
    // or the layout's own element when there is none. The region carries
    // aria-busy while the placeholders stand in; the wave parent attribute
    // lets one sweep cross the group.
    const region = (parentElement ?? result.element) as HTMLElement | null;
    const root = region && isComponent(region) ? (region as any).element : region;
    if (root && typeof root.setAttribute === "function") {
      root.setAttribute("aria-busy", "true");
      if (root.querySelector?.("[data-motion='wave']")) {
        root.setAttribute("data-mtrl-skeleton-wave", "");
      }
      // The region, not the result's own element, is what reveal() clears:
      // when a parent was given, that parent is the region.
      const innerReveal = result.reveal;
      result.reveal = (): void => {
        innerReveal();
        root.removeAttribute("aria-busy");
      };
    }
  }

  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

// Clear functions for the unified system
export function clearClassCache(): void {
  classCache.clear();
}

export function clearFragmentPool(): void {
  fragmentPool.clear();
}

export {
  processClassNames,
  isComponent,
  flattenLayout,
  applyLayoutClasses,
  applyLayoutItemClasses,
  createLayoutResult,
};
