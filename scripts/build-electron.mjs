// Bundles the main process and the preload with esbuild. Both are single files:
// the preload runs sandboxed and can only require "electron" (anything else
// fails silently and `window.dpi` is never defined).

import { build, context } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  // electron-updater loads its platform updater lazily; it ships as a normal
  // dependency instead of being bundled.
  external: ["electron", "electron-updater"],
  sourcemap: watch ? "inline" : false,
  minify: !watch,
  alias: { "@shared": join(root, "src", "shared") },
  logLevel: "info",
};

const targets = [
  { ...common, entryPoints: [join(root, "src/main/index.ts")], outfile: join(root, "out/main/index.js") },
  { ...common, entryPoints: [join(root, "src/preload/index.ts")], outfile: join(root, "out/preload/index.js") },
];

export async function watchElectron(onRebuild) {
  const plugin = {
    name: "notify",
    setup(b) {
      b.onEnd((r) => {
        if (r.errors.length === 0) onRebuild();
      });
    },
  };
  const ctxs = await Promise.all(targets.map((t) => context({ ...t, plugins: [plugin] })));
  await Promise.all(ctxs.map((c) => c.watch()));
  return () => Promise.all(ctxs.map((c) => c.dispose()));
}

if (process.argv[1] === fileURLToPath(import.meta.url) && !watch) {
  await Promise.all(targets.map((t) => build(t)));
}
