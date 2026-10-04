// test/scripts/release-pack.test.ts

import { describe, it, expect, afterEach } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { internalIdRefs, releasePack } from "../../scripts/release-pack.mjs";

// Assembled at runtime so this file carries no ticket id shape, even a fake one.
const TICKET = ["FLO", String(999999)].join("-");

const roots: string[] = [];

// A miniature publishable package: the manifest, the three files releasePack
// always stages, and one shipped content file.
function fixture(contents: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "addons-release-test-"));
  roots.push(root);
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "addons-release-fixture", version: "0.0.0", files: ["content"] }),
  );
  writeFileSync(join(root, "README.md"), "# fixture\n");
  writeFileSync(join(root, "LICENSE"), "MIT\n");
  mkdirSync(join(root, "content"));
  for (const [name, text] of Object.entries(contents)) {
    writeFileSync(join(root, "content", name), text);
  }
  return root;
}

function destination(): string {
  const dir = mkdtempSync(join(tmpdir(), "addons-release-out-"));
  roots.push(dir);
  return dir;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe("internalIdRefs", () => {
  it("finds ticket references and nothing else", () => {
    expect(internalIdRefs(`see ${TICKET} for the why`)).toEqual([TICKET]);
    expect(internalIdRefs("no references here")).toEqual([]);
  });
});

describe("releasePack", () => {
  it("packs a fixture with no references", () => {
    const root = fixture({ "note.txt": "public text\n" });
    const packed = releasePack({ root, destination: destination(), log: false });
    expect(packed.files).toContain("content/note.txt");
  });

  it("refuses a fixture that carries a reference, leaving no tarball", () => {
    const root = fixture({ "note.txt": `public text, ${TICKET} tracks it\n` });
    const out = destination();
    expect(() => releasePack({ root, destination: out, log: false })).toThrow(/content\/note\.txt/);
    expect(readdirSync(out)).toEqual([]);
  });
});
