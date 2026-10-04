// A release's notes, from CHANGELOG.md: the version's section without its
// `## [x.y.z]` heading.
//
//   node scripts/release-notes.mjs 3.0.0 > notes.md
//
// A version with no section, or an empty one, fails: a release without notes
// is a CHANGELOG that was not updated, which is worth stopping for.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** The version's section of the changelog, its `## [x.y.z]` heading left out */
export function changelogSection(changelog, version) {
  const lines = changelog.split("\n");
  const heading = `## [${version}]`;
  const start = lines.findIndex((line) => line === heading || line.startsWith(`${heading} `));
  if (start === -1) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## ["));
  const body = lines.slice(start + 1, next === -1 ? undefined : next).join("\n").trim();
  if (!body) throw new Error(`CHANGELOG.md's section for ${version} is empty`);
  return body;
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  const version = process.argv[2];
  if (!version) {
    console.error("release-notes: usage: node scripts/release-notes.mjs <version>");
    process.exit(1);
  }
  try {
    const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
    process.stdout.write(`${changelogSection(changelog, version)}\n`);
  } catch (error) {
    console.error(`release-notes: ${error.message}`);
    process.exit(1);
  }
}
