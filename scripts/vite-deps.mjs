// The material entries the addons fixtures import. Vite's optimizer discovers
// them on first load; without this list a dependency found mid-run makes it
// re-optimize and reload the page under a check. One list, every browser
// check's `optimizeDeps.include`.
export const MATERIAL_DEPS = [
  "material/components/badge",
  "material/components/button",
  "material/components/divider",
  "material/components/menu",
  "material/components/select",
  "material/core/compose",
  "material/core/dom",
  "material/core/icons",
  "material/elements",
  "material/elements/css/menu",
  "material/elements/css/ripple",
  "material/core/state",
  "material/core/utils",
];
