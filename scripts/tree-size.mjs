// Prints the tree's README size rows: standalone minified ESM bundles,
// gzipped, with `material` (and for the virtual row, `vlist`) external.
import { gzipSync } from "node:zlib";

const read = async (path) => Buffer.from(await Bun.file(path).arrayBuffer());
const gzip = (bytes) => gzipSync(bytes, { level: 9 }).length;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const component = await read("dist/components/tree/index.mjs");
const virtual = await read("dist/components/tree/virtual.mjs");
const sheet = await read("dist/elements/css/tree.css");

console.log(`| Artifact | Measured |`);
console.log(`| --- | --- |`);
console.log(`| createTree | ${kb(gzip(component))} |`);
console.log(`| createVirtualTree (vlist external) | ${kb(gzip(virtual))} |`);
console.log(`| The compiled stylesheet | ${kb(gzip(sheet))} |`);
