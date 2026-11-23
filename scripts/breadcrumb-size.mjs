// Standalone gzip sizes of the breadcrumb, with material external.
//
//   bun scripts/breadcrumb-size.mjs
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
import * as sass from "sass";

const external = (filter, path) => ({
  name: "external",
  setup(build) {
    build.onResolve({ filter }, () => ({ path, external: true }));
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

const factory = await bundle(resolve("src/components/breadcrumb/index.ts"));
const element = await bundle(
  resolve("src/elements/breadcrumb.ts"),
  [external(/^\.\.\/components\/breadcrumb$/, "../components/breadcrumb/index.mjs")],
);
const css = sass.compile("src/styles/components/_breadcrumb.scss", {
  loadPaths: [resolve("node_modules")], style: "compressed", logger: sass.Logger.silent,
}).css;

const rows = {
  factory: gzipSync(Buffer.from(await factory.text())).length,
  element: gzipSync(Buffer.from(await element.text())).length,
  css: gzipSync(Buffer.from(css)).length,
};
const combined = rows.factory + rows.element + rows.css;
const targets = { factory: 1.8 * 1024, element: 0.8 * 1024, css: 0.9 * 1024 };
console.log("| Artifact | Measured | Spec target | Result |");
console.log("|---|---|---|---|");
console.log(row("`createBreadcrumb`", rows.factory, targets.factory));
console.log(row("`<m-breadcrumb>` and `<m-breadcrumb-item>`", rows.element, targets.element));
console.log(row("`_breadcrumb.scss` (compiled)", rows.css, targets.css));
console.log(row("Combined", combined, 3.5 * 1024));
console.error(JSON.stringify(rows));
