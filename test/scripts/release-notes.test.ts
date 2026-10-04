// test/scripts/release-notes.test.ts
//
// The GitHub Release's notes come from CHANGELOG.md (release.yml): each
// version's section, and a loud failure when there is none.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { changelogSection } from "../../scripts/release-notes.mjs";

const CHANGELOG = readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf8");

describe("changelogSection", () => {
  test("3.0.0's section comes out whole: every subsection, and nothing of the next release's", () => {
    const section = changelogSection(CHANGELOG, "3.0.0");
    expect(section.startsWith("The first stable release for material 3, and everything since 0.9.0.")).toBe(true);
    for (const heading of ["### Renamed", "### Breaking changes", "### Migration", "### Changed", "### Fixed"]) {
      expect(section).toContain(`\n${heading}\n`);
    }
    expect(section.endsWith("so the selected option follows the value.")).toBe(true);
    // The heading is left out, and the next section is not swept in.
    expect(section).not.toContain("## [");
    expect(section).not.toContain("There is no 1.0.0. material-addons 3.0.0 is this package's continuation");
  });

  test("a version with no section fails loudly", () => {
    expect(() => changelogSection(CHANGELOG, "9.9.9")).toThrow("CHANGELOG.md has no section for 9.9.9");
    // A version is not matched by a prefix.
    expect(() => changelogSection(CHANGELOG, "3.0")).toThrow("no section");
  });

  const FIXTURE = `# Changelog

Intro.

## [Unreleased]

### Added

- Coming.

## [3.0.0-next.0] - 2026-10-02

The pre-release.

## [0.9.0] - 2026-10-02

### Fixed

- The range band.
`;

  test("a pre-release section and the last section, to the end of the file", () => {
    expect(changelogSection(FIXTURE, "3.0.0-next.0")).toBe("The pre-release.");
    expect(changelogSection(FIXTURE, "0.9.0")).toBe("### Fixed\n\n- The range band.");
  });

  test("an empty section fails too", () => {
    expect(() => changelogSection("## [1.0.0]\n\n## [0.9.0]\n\n- x\n", "1.0.0")).toThrow("is empty");
  });
});
