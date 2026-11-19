// Prints the skeleton's README size rows: standalone minified ESM bundles,
// gzipped, with `material` external. The element's bundle has the factory
// external, as the stepper's does (scripts/stepper-size.mjs).
import { gzipSync } from "node:zlib";

const read = async (path) => Buffer.from(await Bun.file(path).arrayBuffer());
const gzip = (bytes) => gzipSync(bytes, { level: 9 }).length;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const component = await read("dist/components/skeleton/index.mjs");
const sheet = await read("dist/elements/css/skeleton.css");

console.log(`| Artifact | Measured |`);
console.log(`| --- | --- |`);
console.log(`| createSkeleton and the creator map | ${kb(gzip(component))} |`);
console.log(`| The compiled stylesheet | ${kb(gzip(sheet))} |`);
