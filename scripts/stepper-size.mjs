// The stepper's size row, against the targets the spec names.
//
// Measured the way the spec measures: each artifact is a standalone,
// minified ESM bundle, gzipped; `material` and the stepper factory are
// external to the element's bundle, as they already are in an app's bundle.
//
//   node scripts/stepper-size.mjs
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
import * as sass from "sass";

const TARGETS = {
  factory: 2.2 * 1024,
  element: 0.7 * 1024,
  css: 1.4 * 1024,
};

const factoryExternal = {
  name: "stepper-factory-external",
  setup(build) {
    build.onResolve({ filter: /^\.\.\/components\/stepper$/ }, () => ({
      path: "../components/stepper",
      external: true,
    }));
  },
};

const bundle = async (entry, plugins = []) => {
  const result = await Bun.build({
    entrypoints: [entry],
    minify: true,
    format: "esm",
    target: "browser",
    external: ["material"],
    plugins,
  });
  if (!result.success) throw new Error(`build failed: ${entry}`);
  return result.outputs[0];
};

const row = (name, bytes, target) => {
  const kb = (bytes / 1024).toFixed(2);
  const goal = (target / 1024).toFixed(1);
  return `| ${name} | ${kb} KB gzip | <= ${goal} KB gzip | ${bytes <= target ? "within" : `over by ${(bytes - target)} B`} |`;
};

const factory = await bundle(resolve("src/components/stepper/index.ts"));
const element = await bundle(resolve("src/elements/stepper.ts"), [factoryExternal]);
const css = sass.compile("src/styles/components/_stepper.scss", {
  loadPaths: [resolve("node_modules")],
  style: "compressed",
  logger: sass.Logger.silent,
}).css;

const rows = {
  factory: gzipSync(Buffer.from(await factory.text())).length,
  element: gzipSync(Buffer.from(await element.text())).length,
  css: gzipSync(Buffer.from(css)).length,
};

console.log("| Artifact | Measured | Spec target | Result |");
console.log("|---|---|---|---|");
console.log(row("`createStepper`", rows.factory, TARGETS.factory));
console.log(row("`<m-stepper>` + `<m-step>`", rows.element, TARGETS.element));
console.log(row("`_stepper.scss` (compiled)", rows.css, TARGETS.css));
console.log(
  row(
    "Combined",
    rows.factory + rows.element + rows.css,
    TARGETS.factory + TARGETS.element + TARGETS.css,
  ),
);
