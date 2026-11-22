// Prints the alert's README size rows: standalone minified ESM bundles,
// gzipped at level 9, with `material` external and the element's factory external.
import { gzipSync } from "node:zlib";

const read = async (path) => Buffer.from(await Bun.file(path).arrayBuffer());
const gzip = (bytes) => gzipSync(bytes, { level: 9 }).length;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const component = await read("dist/components/alert/index.mjs");
const element = await read("dist/elements/alert.mjs");
const sheet = await read("dist/elements/css/alert.css");

console.log(`| Artifact | Measured | Target |`);
console.log(`| --- | --- | --- |`);
console.log(`| \`createAlert\` | ${kb(gzip(component))} | 1.8 KB |`);
console.log(`| \`<m-alert>\` | ${kb(gzip(element))} | 0.9 KB |`);
console.log(`| The compiled stylesheet | ${kb(gzip(sheet))} | 1.1 KB |`);
