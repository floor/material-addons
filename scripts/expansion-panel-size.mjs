// The expansion panel's size row, against the spec's targets. Measured the
// same way as the stepper: a standalone minified ESM bundle, gzipped, with
// `material` external (and the factories external from the element bundle).
//
//   bun scripts/expansion-panel-size.mjs
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
import * as sass from "sass";

const TARGETS = { factory: 1.4 * 1024, element: 0.6 * 1024, css: 0.9 * 1024 };

const factoryExternal = {
  name: "expansion-factories-external",
  setup(build) {
    build.onResolve({ filter: /^\.\.\/components\/expansion-panel$/ }, () => ({
      path: "../components/expansion-panel",
      external: true,
    }));
  },
};

const bundle = async (entry, plugins = []) => {
  const result = await Bun.build({
    entrypoints: [entry], minify: true, format: "esm", target: "browser",
    external: ["material"], plugins,
  });
  if (!result.success) throw new Error(`build failed: ${entry}`);
  return result.outputs[0];
};

const row = (name, bytes, target) => {
  const kb = (bytes / 1024).toFixed(2);
  const goal = (target / 1024).toFixed(1);
  return `| ${name} | ${kb} KB gzip | <= ${goal} KB gzip | ${bytes <= target ? "within" : `over by ${bytes - target} B`} |`;
};

const factory = await bundle(resolve("src/components/expansion-panel/index.ts"));
const element = await bundle(resolve("src/elements/expansion-panel.ts"), [factoryExternal]);
const css = sass.compile("src/styles/components/_expansion-panel.scss", {
  loadPaths: [resolve("node_modules")], style: "compressed", logger: sass.Logger.silent,
}).css;

const rows = {
  factory: gzipSync(Buffer.from(await factory.text())).length,
  element: gzipSync(Buffer.from(await element.text())).length,
  css: gzipSync(Buffer.from(css)).length,
};

console.log("| Artifact | Measured | Spec target | Result |");
console.log("|---|---|---|---|");
console.log(row("`createExpansionPanel` + `createAccordion`", rows.factory, TARGETS.factory));
console.log(row("`<m-expansion-panel>` + `<m-accordion>`", rows.element, TARGETS.element));
console.log(row("`_expansion-panel.scss` (compiled)", rows.css, TARGETS.css));
console.log(row("Combined", rows.factory + rows.element + rows.css, TARGETS.factory + TARGETS.element + TARGETS.css));
