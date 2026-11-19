import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { releasePack } from "./release-pack.mjs";

// Recorded before the first commit on this branch, from
// `fnm exec --using=22 -- npm pack --dry-run --json` after a production build.
const EXPECTED_PATHS = [
  "LICENSE",
  "README.md",
  "dist/adapters/react.d.ts",
  "dist/adapters/solid.d.ts",
  "dist/adapters/stepper.d.ts",
  "dist/adapters/svelte.d.ts",
  "dist/adapters/vue.d.ts",
  "dist/react/index.d.ts",
  "dist/react/index.mjs",
  "dist/solid/index.d.ts",
  "dist/solid/index.mjs",
  "dist/vue/index.d.ts",
  "dist/vue/index.mjs",
  "dist/svelte/index.js",
  "dist/svelte/index.d.ts",
  "dist/svelte/runtime.mjs",
  "dist/svelte/Stepper.svelte",
  "dist/svelte/Stepper.svelte.d.ts",
  "dist/svelte/Step.svelte",
  "dist/svelte/Step.svelte.d.ts",
  "dist/components/colorpicker/api.d.ts",
  "dist/components/colorpicker/colorpicker.d.ts",
  "dist/components/colorpicker/config.d.ts",
  "dist/components/colorpicker/constants.d.ts",
  "dist/components/colorpicker/constants.mjs",
  "dist/components/colorpicker/features/area.d.ts",
  "dist/components/colorpicker/features/hue.d.ts",
  "dist/components/colorpicker/features/index.d.ts",
  "dist/components/colorpicker/features/input.d.ts",
  "dist/components/colorpicker/features/opacity.d.ts",
  "dist/components/colorpicker/features/pipette.d.ts",
  "dist/components/colorpicker/features/swatches.d.ts",
  "dist/components/colorpicker/features/variant.d.ts",
  "dist/components/colorpicker/index.d.ts",
  "dist/components/colorpicker/types.d.ts",
  "dist/components/colorpicker/utils.d.ts",
  "dist/components/form/config.d.ts",
  "dist/components/form/constants.d.ts",
  "dist/components/form/constants.mjs",
  "dist/components/form/features/api.d.ts",
  "dist/components/form/features/controller.d.ts",
  "dist/components/form/features/data.d.ts",
  "dist/components/form/features/fields.d.ts",
  "dist/components/form/features/index.d.ts",
  "dist/components/form/features/layout.d.ts",
  "dist/components/form/features/protection.d.ts",
  "dist/components/form/features/submit.d.ts",
  "dist/components/form/form.d.ts",
  "dist/components/form/index.d.ts",
  "dist/components/form/types.d.ts",
  "dist/components/index.d.ts",
  "dist/components/index.mjs",
  "dist/components/stepper/api.d.ts",
  "dist/components/stepper/config.d.ts",
  "dist/components/stepper/constants.d.ts",
  "dist/components/stepper/constants.mjs",
  "dist/components/stepper/features/index.d.ts",
  "dist/components/stepper/features/keyboard.d.ts",
  "dist/components/stepper/features/navigation.d.ts",
  "dist/components/stepper/features/orientation.d.ts",
  "dist/components/stepper/features/renderer.d.ts",
  "dist/components/stepper/index.d.ts",
  "dist/components/stepper/index.mjs",
  "dist/components/stepper/stepper.d.ts",
  "dist/components/stepper/types.d.ts",
  "dist/core/compose/features/gestures/index.d.ts",
  "dist/core/compose/features/gestures/longpress.d.ts",
  "dist/core/compose/features/gestures/pan.d.ts",
  "dist/core/compose/features/gestures/pinch.d.ts",
  "dist/core/compose/features/gestures/rotate.d.ts",
  "dist/core/compose/features/gestures/swipe.d.ts",
  "dist/core/compose/features/gestures/tap.d.ts",
  "dist/core/compose/features/index.d.ts",
  "dist/core/compose/index.d.ts",
  "dist/core/gestures/index.d.ts",
  "dist/core/gestures/index.mjs",
  "dist/core/gestures/longpress.d.ts",
  "dist/core/gestures/manager.d.ts",
  "dist/core/gestures/pan.d.ts",
  "dist/core/gestures/pinch.d.ts",
  "dist/core/gestures/rotate.d.ts",
  "dist/core/gestures/swipe.d.ts",
  "dist/core/gestures/tap.d.ts",
  "dist/core/gestures/types.d.ts",
  "dist/core/gestures/utils.d.ts",
  "dist/core/index.d.ts",
  "dist/core/layout/config.d.ts",
  "dist/core/layout/index.d.ts",
  "dist/core/layout/index.mjs",
  "dist/core/layout/jsx.d.ts",
  "dist/core/layout/schema.d.ts",
  "dist/core/layout/types.d.ts",
  "dist/elements/css/stepper.css",
  "dist/elements/css/stepper.d.ts",
  "dist/elements/css/stepper.js",
  "dist/elements/index.d.ts",
  "dist/elements/index.mjs",
  "dist/elements/stepper.d.ts",
  "dist/elements/stepper.mjs",
  "dist/index.d.ts",
  "dist/index.mjs",
  "dist/styles.css",
  "package.json",
  "src/styles/components/_colorpicker.scss",
  "src/styles/components/_form.scss",
  "src/styles/components/_stepper.scss",
  "src/styles/core/_layout.scss",
  "src/styles/elements/_stepper.scss",
  "src/styles/index.scss",
];

const SHIPPED_FIELDS = [
  "name",
  "version",
  "type",
  "exports",
  "main",
  "module",
  "types",
  "files",
  "peerDependencies",
  "peerDependenciesMeta",
  "sideEffects",
  "repository",
  "bugs",
  "homepage",
  "license",
  "keywords",
  "description",
  "author",
];

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${result.error ?? ""}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
};

// Exercise the release tarball consumers receive, outside the source checkout.
const root = process.cwd();
const source = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const fixture = mkdtempSync(join(tmpdir(), "material-addons-package-"));
try {
  const packed = releasePack({ root, destination: fixture, log: false });
  assert.deepEqual([...packed.files].sort(), [...EXPECTED_PATHS].sort());

  const modules = join(fixture, "node_modules");
  const addon = join(modules, "material-addons");
  mkdirSync(addon, { recursive: true });
  run("tar", ["-xzf", packed.tarball, "--strip-components=1", "-C", addon], root);
  symlinkSync(resolve(root, "node_modules/material"), join(modules, "material"), "junction");
  const pkg = JSON.parse(readFileSync(join(addon, "package.json"), "utf8"));
  assert.equal(Object.hasOwn(pkg, "scripts"), false);
  assert.equal(Object.hasOwn(pkg, "devDependencies"), false);
  for (const field of SHIPPED_FIELDS) {
    assert.deepEqual(pkg[field], source[field], field);
  }

  const specifiers = [];
  const adapters = new Map([["./react", "react"], ["./vue", "vue"], ["./solid", "solid-js"]]);
  for (const [entry, conditions] of Object.entries(pkg.exports)) {
    const components = entry.includes("*") ? ["form", "colorpicker"] : [""];
    for (const component of components) {
      const paths = typeof conditions === "string" ? [conditions] : Object.values(conditions);
      for (const path of paths) {
        assert.ok(existsSync(join(addon, path.replace("*", component))), `Missing export: ${path}`);
      }
      // A stylesheet entry registers CSS and exports nothing, like ./styles
      if (entry !== "./styles" && !entry.includes("/css/") && !adapters.has(entry) && entry !== "./svelte") {
        specifiers.push(entry === "." ? pkg.name : pkg.name + entry.slice(1).replace("*", component));
      }
    }
  }
  assert.equal(specifiers.length, 9);
  run(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    for (const specifier of ${JSON.stringify(specifiers)}) {
      const esm = await import(specifier);
      assert.ok(Object.keys(esm).length, specifier + ' has no exports');
      // ESM only, as material 3: no require condition, so require does not resolve
      assert.throws(() => require(specifier), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' }, specifier);
    }
  `], fixture);
  for (const [entry, peer] of adapters) {
    symlinkSync(resolve(root, "node_modules", peer), join(modules, peer), "junction");
    const name = entry === "./vue" ? "MStepper" : "Stepper";
    const child = entry === "./vue" ? "MStep" : "Step";
    run(process.execPath, ["--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      const adapter = await import(${JSON.stringify(pkg.name + entry.slice(1))});
      assert.ok(adapter.${name} && adapter.${child});
    `], fixture);
  }
  assert.match(readFileSync(join(addon, "dist/react/index.mjs"), "utf8"), /^"use client";/);
  run(process.execPath, ["--conditions=svelte", "--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    assert.match(import.meta.resolve("material-addons/svelte"), new RegExp("dist/svelte/index[.]js$"));
  `], fixture);
  for (const peer of ["react", "vue", "solid-js", "svelte"]) {
    assert.equal(pkg.peerDependenciesMeta[peer]?.optional, true, peer);
  }
  console.log(`Packed ${pkg.name}@${pkg.version}: manifest has no scripts or devDependencies; ${packed.files.length} paths; ${specifiers.length} entry points import as ESM and refuse require.`);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
