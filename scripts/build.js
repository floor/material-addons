import { writeSvelteAdapters } from "./generate-adapters.mjs";
// build.js
import { mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { watch } from "fs";
import { readListboxStyle } from "./listbox-style.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const isWatch = process.argv.includes("--watch");
const isProduction =
  process.argv.includes("--production") ||
  process.env.NODE_ENV === "production";

// Define consistent output paths
const DIST_DIR = join(ROOT_DIR, "dist");
const MJS_OUTPUT = join(DIST_DIR, "index.mjs");
const CSS_OUTPUT = join(DIST_DIR, "styles.css");
const STYLES_ENTRY = join(ROOT_DIR, "src/styles/index.scss");
const AUTOCOMPLETE_CSS = join(DIST_DIR, "components/autocomplete/autocomplete.css");
const PREUPGRADE_CSS = join(DIST_DIR, "elements/preupgrade.css");

// Granular module entry points for tree-shaking
// Adapter bundles import their public element entry instead of duplicating it.
const adapterPlugin = {
  name: "stepper-element-entry",
  setup(build) {
    build.onResolve({ filter: /^\.\.\/elements\/stepper$/ }, () => ({
      path: "material-addons/elements/stepper", external: true,
    }));
  },
};

const MODULES = [
  ...["react", "vue", "solid"].map(framework => ({
    name: framework, entry: `src/${framework}/index.ts`, outDir: `dist/${framework}`, adapter: true,
  })),
  { name: "svelte runtime", entry: "src/adapters/svelte.ts", outDir: "dist/svelte", basename: "runtime", adapter: true },
  {
    name: "form constants",
    entry: "src/components/form/constants.ts",
    outDir: "dist/components/form",
    basename: "constants",
  },
  {
    name: "colorpicker constants",
    entry: "src/components/colorpicker/constants.ts",
    outDir: "dist/components/colorpicker",
    basename: "constants",
  },
  {
    name: "autocomplete",
    entry: "src/components/autocomplete/index.ts",
    outDir: "dist/components/autocomplete",
  },
  {
    name: "autocomplete constants",
    entry: "src/components/autocomplete/constants.ts",
    outDir: "dist/components/autocomplete",
    basename: "constants",
  },
  {
    name: "autocomplete element",
    entry: "src/elements/autocomplete.ts",
    outDir: "dist/elements",
    basename: "autocomplete",
    plugins: [{
      name: "reuse-addon-factory",
      setup(build) {
        build.onResolve({ filter: /^\.\.\/components\/autocomplete$/ }, () => ({
          path: "../components/autocomplete/index.mjs", external: true,
        }));
      },
    }],
  },
  {
    name: "layout",
    entry: "src/core/layout/index.ts",
    outDir: "dist/core/layout",
    plugins: [{
      // The skeleton creator map is one instance: the layout module imports
      // the public component subpath instead of bundling its own copy, so a
      // registration the consumer made reaches the layout's placeholders.
      name: "skeleton-map-entry",
      setup(build) {
        build.onResolve({ filter: /^\.\.\/\.\.\/components\/skeleton$/ }, () => ({
          path: "material-addons/components/skeleton", external: true,
        }));
      },
    }],
  },
  {
    name: "gestures",
    entry: "src/core/gestures/index.ts",
    outDir: "dist/core/gestures",
  },
  {
    name: "components",
    entry: "src/components/index.ts",
    outDir: "dist/components",
  },
  {
    name: "skeleton constants",
    entry: "src/components/skeleton/constants.ts",
    outDir: "dist/components/skeleton",
    basename: "constants",
  },
  {
    name: "skeleton component",
    entry: "src/components/skeleton/index.ts",
    outDir: "dist/components/skeleton",
    basename: "index",
  },
  {
    name: "skeleton element",
    entry: "src/elements/skeleton.ts",
    outDir: "dist/elements",
    basename: "skeleton",
  },
  {
    name: "stepper constants",
    entry: "src/components/stepper/constants.ts",
    outDir: "dist/components/stepper",
    basename: "constants",
  },
  {
    name: "stepper component",
    entry: "src/components/stepper/index.ts",
    outDir: "dist/components/stepper",
    basename: "index",
  },
  {
    name: "elements",
    entry: "src/elements/index.ts",
    outDir: "dist/elements",
    basename: "index",
  },
];

// Log build mode
console.log(`Building in ${isProduction ? "PRODUCTION" : "DEVELOPMENT"} mode`);

const buildStyles = async () => {
  console.log("┌─────────────────────────────────────────");
  console.log("│ SCSS Build");
  console.log("│ Mode:", isProduction ? "PRODUCTION" : "DEVELOPMENT");
  console.log("└─────────────────────────────────────────");

  try {
    // Check if source file exists
    if (!existsSync(STYLES_ENTRY)) {
      console.log("⚠️ No SCSS entry found at", STYLES_ENTRY);
      return true; // Not an error, just no styles to build
    }

    // Build sass arguments
    const sassArgs = [
      "sass",
      `${STYLES_ENTRY}:${CSS_OUTPUT}`,
      `${join(ROOT_DIR, "src/styles/components/_autocomplete.scss")}:${AUTOCOMPLETE_CSS}`,
      `${join(ROOT_DIR, "src/styles/elements/_autocomplete.scss")}:${PREUPGRADE_CSS}`,
      isProduction ? "--style=compressed" : "--style=expanded",
      // material's abstracts are used by @use "material/src/styles/…"; it publishes
      // src/styles for exactly this. Without a load path sass would only find
      // them through a sibling checkout on disk, which is how this build came
      // to work on a developer's machine and nowhere else.
      "--load-path=node_modules",
    ];

    // Add source map in development
    if (!isProduction) {
      sassArgs.push("--source-map");
    } else {
      sassArgs.push("--no-source-map");
    }

    const sassProcess = Bun.spawn(["npx", ...sassArgs], {
      cwd: ROOT_DIR,
      stdio: ["inherit", "pipe", "pipe"],
    });

    const stdout = await new Response(sassProcess.stdout).text();
    const stderr = await new Response(sassProcess.stderr).text();
    const exitCode = await sassProcess.exited;

    if (exitCode !== 0) {
      console.error("❌ SCSS build failed");
      if (stdout.trim()) console.error("STDOUT:", stdout);
      if (stderr.trim()) console.error("STDERR:", stderr);
      return false;
    }

    // Get file size
    const cssSize = existsSync(CSS_OUTPUT)
      ? (await Bun.file(CSS_OUTPUT).size) / 1024
      : 0;

    const autocomplete = (await Bun.file(AUTOCOMPLETE_CSS).text()).replace(/\/\*# sourceMappingURL=.*?\*\/\s*$/, "");
    const styles = { listbox: readListboxStyle(), autocomplete };
    await Bun.write(join(DIST_DIR, "elements/autocomplete-css.mjs"), [
      'import "material/elements/css/text-field";',
      'import { registerStyles } from "material/elements";',
      `registerStyles(${JSON.stringify(styles)});`,
      "",
    ].join("\n"));
    await Bun.write(join(DIST_DIR, "elements/autocomplete-css.d.ts"), "export {};\n");

    console.log("✓ SCSS build successful");
    console.log(`  CSS bundle: ${cssSize.toFixed(2)} KB`);

    return await buildElementStyles();
  } catch (error) {
    console.error("❌ SCSS build error:", error.message);

    // Check if sass is available
    try {
      const checkSass = Bun.spawn(["npx", "sass", "--version"], {
        stdio: ["inherit", "pipe", "pipe"],
      });
      const versionExitCode = await checkSass.exited;

      if (versionExitCode !== 0) {
        console.error("💡 Sass compiler not found. Install it with:");
        console.error("   npm install -D sass");
        console.error("   or");
        console.error("   bun add -D sass");
      }
    } catch {
      console.error("💡 Sass compiler not found. Install it with:");
      console.error("   npm install -D sass");
      console.error("   or");
      console.error("   bun add -D sass");
    }

    return false;
  }
};

/**
 * The stepper's shadow-root CSS, as the module that registers it.
 *
 * A shadow root does not inherit the document's stylesheets, so an element's
 * own sheet ships as JS that hands the text to `material`'s style registry,
 * the way `material/elements/css/<name>` does. The same text is written as a
 * plain stylesheet for a page that links its shadow CSS instead.
 */
const buildElementStyles = async () => {
  const dir = join(DIST_DIR, "elements/css");
  await mkdir(dir, { recursive: true });
  const source = "src/styles/components/_stepper.scss";
  const result = Bun.spawn(
    ["npx", "sass", source, "--style=compressed", "--no-source-map", "--load-path=node_modules"],
    { cwd: ROOT_DIR, stdio: ["inherit", "pipe", "pipe"] },
  );
  const css = await new Response(result.stdout).text();
  const stderr = await new Response(result.stderr).text();
  if ((await result.exited) !== 0) {
    console.error("❌ Element stylesheet build failed");
    if (stderr.trim()) console.error("STDERR:", stderr);
    return false;
  }
  await Bun.write(join(dir, "stepper.css"), css);

  // The skeleton's own shadow-root CSS, the same shape as the stepper's.
  {
    const source = "src/styles/components/_skeleton.scss";
    const result = Bun.spawn(
      ["npx", "sass", source, "--style=compressed", "--no-source-map", "--load-path=node_modules"],
      { cwd: ROOT_DIR, stdio: ["inherit", "pipe", "pipe"] },
    );
    const css = await new Response(result.stdout).text();
    const stderr = await new Response(result.stderr).text();
    if ((await result.exited) !== 0) {
      console.error("❌ Skeleton element stylesheet build failed");
      if (stderr.trim()) console.error("STDERR:", stderr);
      return false;
    }
    await Bun.write(join(dir, "skeleton.css"), css);
    await Bun.write(
      join(dir, "skeleton.js"),
      'import "material/elements/css/ripple";\n' +
      'import { registerStyles } from "material/elements";\n' +
        `registerStyles({ skeleton: ${JSON.stringify(css)} });\n`,
    );
    await Bun.write(join(dir, "skeleton.d.ts"), "export {};\n");
    await Bun.write(
      join(DIST_DIR, "elements/skeleton.mjs"),
      'export { skeletonElement, defineSkeleton, skeletonElementEventNames } from "./index.mjs";\n',
    );
  }

  await Bun.write(
    join(dir, "stepper.js"),
    // The shadow base an element adopts first: material's ripple sheet
    'import "material/elements/css/ripple";\n' +
      'import { registerStyles } from "material/elements";\n' +
      `registerStyles({ stepper: ${JSON.stringify(css)} });\n`,
  );
  await Bun.write(join(dir, "stepper.d.ts"), "export {};\n");
  // The named subpath the docs use re-exports the elements entry; keeping it a
  // file of its own lets a bundler resolve the subpath without the shim being
  // a second copy of the code.
  await Bun.write(
    join(DIST_DIR, "elements/stepper.mjs"),
    'export { stepperElement, stepDeclaration, defineStepper, stepperElementEventNames } from "./index.mjs";\n',
  );
  console.log(`  Element stylesheet: ${(css.length / 1024).toFixed(2)} KB`);
  return true;
};

const buildModule = async (module) => {
  const entryPath = join(ROOT_DIR, module.entry);
  const outDir = join(ROOT_DIR, module.outDir);
  const basename = module.basename ?? "index";

  // Skip if entry doesn't exist
  if (!existsSync(entryPath)) {
    console.log(`  ⚠️ Skipping ${module.name}: entry not found`);
    return true;
  }

  await mkdir(outDir, { recursive: true });

  // Build ESM version
  const esmResult = await Bun.build({
    entrypoints: [entryPath],
    outdir: outDir,
    minify: isProduction,
    sourcemap: isProduction ? "none" : "inline",
    format: "esm",
    target: "node",
    naming: {
      entry: `${basename}.mjs`,
    },
    external: module.adapter ? ["material", "material-addons", "react", "vue", "solid-js", "svelte"] : ["material"],
    plugins: module.adapter ? [adapterPlugin] : module.plugins,
    banner: module.name === "react" ? '"use client";' : undefined,
  });

  if (!esmResult.success) {
    console.error(`  ❌ ${module.name} build failed`);
    return false;
  }

  const esmSize = (await Bun.file(join(outDir, `${basename}.mjs`)).size) / 1024;
  console.log(`  ✓ ${module.name}: ESM ${esmSize.toFixed(1)}KB`);

  return true;
};

const buildApp = async () => {
  try {
    console.log("┌─────────────────────────────────────────");
    console.log("│ JavaScript Build");
    console.log("│ Mode:", isProduction ? "PRODUCTION" : "DEVELOPMENT");
    console.log("│ Minify:", isProduction ? "Yes" : "No");
    console.log("│ Sourcemaps:", isProduction ? "No" : "Yes (inline)");
    console.log("└─────────────────────────────────────────");

    // Create dist directory if it doesn't exist
    await mkdir(DIST_DIR, { recursive: true });

    // ESM only, as material 3 (its subpaths have no require condition)
    // Build ESM version
    const esmResult = await Bun.build({
      entrypoints: [join(ROOT_DIR, "src/index.ts")],
      outdir: DIST_DIR,
      minify: isProduction,
      sourcemap: isProduction ? "none" : "inline",
      format: "esm",
      target: "node",
      naming: {
        entry: "index.mjs",
      },
      external: ["material"],
    });

    if (!esmResult.success) {
      console.error("❌ JavaScript build failed");
      console.error(esmResult.logs);
      return false;
    }

    console.log("✓ Main bundle built");
    console.log(
      `  ESM bundle: ${((await Bun.file(MJS_OUTPUT).size) / 1024).toFixed(
        2,
      )} KB`,
    );

    // Build granular modules
    console.log("Building granular modules...");
    for (const module of MODULES) {
      const success = await buildModule(module);
      if (!success) {
        console.error(`❌ Module ${module.name} build failed`);
        return false;
      }
    }
    console.log("✓ All granular modules built");

    // Generate type definitions with better error handling
    console.log("Generating TypeScript declarations...");

    try {
      const tscProcess = Bun.spawn(
        ["tsc", "--emitDeclarationOnly", "--outDir", DIST_DIR],
        {
          cwd: ROOT_DIR,
          stdio: ["inherit", "pipe", "pipe"],
        },
      );

      // Capture stdout and stderr
      const stdout = await new Response(tscProcess.stdout).text();
      const stderr = await new Response(tscProcess.stderr).text();

      const tscExitCode = await tscProcess.exited;

      if (tscExitCode !== 0) {
        console.warn(
          "⚠️ TypeScript declaration generation failed",
        );
        if (stdout.trim()) {
          console.warn(
            "STDOUT:",
            stdout.slice(0, 500) + (stdout.length > 500 ? "..." : ""),
          );
        }
        if (stderr.trim()) {
          console.warn(
            "STDERR:",
            stderr.slice(0, 500) + (stderr.length > 500 ? "..." : ""),
          );
        }

        // Check if tsc is available
        const whichResult = Bun.spawn(["which", "tsc"], {
          stdio: ["inherit", "pipe", "pipe"],
        });
        const tscPath = await new Response(whichResult.stdout).text();
        if (!tscPath.trim()) {
          console.error(
            "💡 TypeScript compiler (tsc) not found. Install it with:",
          );
          console.error("   npm install -g typescript");
          console.error("   or");
          console.error("   bun add -g typescript");
        }

        // Published entry points require declarations.
        return false;
      }

      console.log("✓ TypeScript declarations generated");
      if (stdout.trim()) {
        console.log("TSC output:", stdout);
      }

      return true;
    } catch (tscError) {
      console.warn("⚠️ Error running TypeScript compiler:", tscError.message);

      // Check if TypeScript is installed
      try {
        const checkTsc = Bun.spawn(["tsc", "--version"], {
          stdio: ["inherit", "pipe", "pipe"],
        });
        const versionOutput = await new Response(checkTsc.stdout).text();
        const versionExitCode = await checkTsc.exited;

        if (versionExitCode === 0) {
          console.log("TypeScript version:", versionOutput.trim());
        } else {
          console.warn(
            "💡 TypeScript compiler not properly installed. Install with:",
          );
          console.warn("   npm install -g typescript");
          console.warn("   or");
          console.warn("   bun add -g typescript");
        }
      } catch (versionError) {
        console.warn("💡 TypeScript compiler not found. Install it with:");
        console.warn("   npm install -g typescript");
        console.warn("   or");
        console.warn("   bun add -g typescript");
      }

      // Published entry points require declarations.
      return false;
    }
  } catch (error) {
    console.error("❌ JavaScript build error:", error);
    console.error(error.stack);
    return false;
  }
};

const buildAll = async () => {
  await writeSvelteAdapters(join(DIST_DIR, "svelte"));
  const jsSuccess = await buildApp();
  const cssSuccess = await buildStyles();
  return jsSuccess && cssSuccess;
};

const build = async () => {
  try {
    const startTime = Date.now();

    console.log("┌───────────────────────────────────────────────");
    console.log("│ 🚀 MTRL-Addons Build Process");
    console.log("│ Mode:", isProduction ? "🏭 PRODUCTION" : "🔧 DEVELOPMENT");
    console.log("│ Watch:", isWatch ? "✓ Enabled" : "✗ Disabled");
    console.log("└───────────────────────────────────────────────");
    console.log("");

    // Drop stale bundles and source maps before a complete build.
    await rm(DIST_DIR, { recursive: true, force: true });
    // Create output directory
    await mkdir(DIST_DIR, { recursive: true });

    // Build JavaScript and CSS
    const buildSuccess = await buildAll();

    const buildTime = ((Date.now() - startTime) / 1000).toFixed(2);

    if (isWatch && !isProduction) {
      console.log("");
      console.log("┌───────────────────────────────────────────────");
      console.log("│ 👀 Watching for changes...");
      console.log("└───────────────────────────────────────────────");

      // Watch src directory for changes
      const srcDir = join(ROOT_DIR, "src");
      let debounceTimer = null;
      let isBuilding = false;

      const rebuild = async (changedFile) => {
        if (isBuilding) return;
        isBuilding = true;

        const ext = changedFile ? extname(changedFile) : "";
        const isStyleChange = [".scss", ".css"].includes(ext);
        const isJsChange = [".ts", ".tsx"].includes(ext);

        console.log("");
        console.log("┌───────────────────────────────────────────────");
        console.log(
          `│ 🔄 Change detected${changedFile ? ` (${changedFile})` : ""}, rebuilding...`,
        );
        console.log("└───────────────────────────────────────────────");

        const rebuildStart = Date.now();
        let success;

        // Selective rebuild based on file type
        if (isStyleChange) {
          success = await buildStyles();
        } else if (isJsChange) {
          success = await buildApp();
        } else {
          success = await buildAll();
        }

        const rebuildTime = ((Date.now() - rebuildStart) / 1000).toFixed(2);

        console.log("");
        console.log(
          `│ ${success ? "✅" : "⚠️"} Rebuild completed in ${rebuildTime}s`,
        );
        console.log("│ 👀 Watching for changes...");
        console.log("└───────────────────────────────────────────────");

        isBuilding = false;
      };

      const watchHandler = (eventType, filename) => {
        if (!filename) return;

        // Only watch .ts, .tsx, .scss and .css files
        const ext = extname(filename);
        if (![".ts", ".tsx", ".scss", ".css"].includes(ext)) return;

        // Debounce rapid changes
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          rebuild(filename);
        }, 100);
      };

      // Watch recursively using fs.watch
      const watchDir = (dir) => {
        watch(dir, { recursive: true }, watchHandler);
      };

      watchDir(srcDir);
      console.log(`│ Watching: ${srcDir}`);

      // Keep process alive
      process.on("SIGINT", () => {
        console.log("\n│ 👋 Stopping watch mode...");
        process.exit(0);
      });
    } else {
      console.log("");
      console.log("┌───────────────────────────────────────────────");
      console.log(`│ ✅ Build completed in ${buildTime}s`);
      if (!buildSuccess) {
        console.log("│ ⚠️ Build completed with some errors");
      }
      console.log("└───────────────────────────────────────────────");

      // Only exit with error code in non-watch mode if there were failures
      if (!isWatch && !buildSuccess) {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error("❌ Build failed with error:", error);
    process.exit(1);
  }
};

build();
