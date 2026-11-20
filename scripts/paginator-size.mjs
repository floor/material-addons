// Standalone gzip sizes of the paginator, with material external.
//
//   bun scripts/paginator-size.mjs
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
import * as sass from "sass";

const external = (filter) => ({
  name: "external",
  setup(build) {
    build.onResolve({ filter }, (args) => ({ path: args.path, external: true }));
  },
});

const bundle = async (entry, plugins = []) => {
  const result = await Bun.build({
    entrypoints: [entry], target: "browser", minify: true,
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

const factory = await bundle(resolve("src/components/paginator/index.ts"));
export const factoryExternal = {
  name: "reuse-factory",
  setup(build) {
    build.onResolve({ filter: /^\.\.\/components\/paginator$/ }, () => ({
      path: "../components/paginator/index.mjs", external: true,
    }));
  },
};
const element = await bundle(resolve("src/elements/paginator.ts"), [factoryExternal]);
const css = sass.compile("src/styles/components/_paginator.scss", {
  loadPaths: [resolve("node_modules")], style: "compressed", logger: sass.Logger.silent,
}).css;

const rows = {
  factory: gzipSync(Buffer.from(await factory.text())).length,
  element: gzipSync(Buffer.from(await element.text())).length,
  css: gzipSync(Buffer.from(css)).length,
};
const combined = rows.factory + rows.element + rows.css;
const targets = { factory: 1.6 * 1024, element: 0.7 * 1024, css: 0.9 * 1024 };
console.log("| Artifact | Measured | Spec target | Result |");
console.log("|---|---|---|---|");
console.log(row("`createPaginator`", rows.factory, targets.factory));
console.log(row("`<m-paginator>`", rows.element, targets.element));
console.log(row("`_paginator.scss` (compiled)", rows.css, targets.css));
console.log(row("Combined", combined, 3.2 * 1024));
console.error(JSON.stringify(rows));
