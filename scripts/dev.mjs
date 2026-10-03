// Development: Vite for the renderer (with HMR), esbuild watch for main and
// preload, and Electron restarted whenever the main process changes.
//
// Filtering traffic needs administrator rights. Run `pnpm dev` from an
// elevated terminal, or use the "Restart as administrator" button in the app.

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { watchElectron } from "./build-electron.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const electronPath = createRequire(import.meta.url)("electron");

const server = await createServer({ configFile: join(root, "vite.config.mts") });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? "http://localhost:5317/";

// Same as HANDOFF_EXIT_CODE in src/main/system/elevation.ts.
const HANDOFF_EXIT_CODE = 75;

let child = null;
let restarting = false;
let handedOff = false;

function startElectron() {
  const env = { ...process.env, DPI_DEV_SERVER: url };
  // Some shells export this; it makes Electron behave as plain Node.
  delete env.ELECTRON_RUN_AS_NODE;
  child = spawn(electronPath, [root], { stdio: "inherit", env });
  child.on("exit", (code) => {
    if (restarting) return;
    if (code === HANDOFF_EXIT_CODE) {
      // "Restart as administrator": the elevated copy is not our child, but it
      // loads the renderer from this server, so the server has to stay up.
      handedOff = true;
      child = null;
      console.log(
        "\n[dev] Electron restarted as administrator. The renderer still hot-reloads;" +
          "\n[dev] main-process changes need a restart. Quit from the tray, then Ctrl+C here.\n",
      );
      return;
    }
    void server.close();
    process.exit(0);
  });
}

let first = true;
await watchElectron(() => {
  if (first) {
    first = false;
    startElectron();
    return;
  }
  if (handedOff) {
    console.log("[dev] main process rebuilt; restart the elevated app to load it");
    return;
  }
  if (!child) return;
  restarting = true;
  child.once("exit", () => {
    restarting = false;
    startElectron();
  });
  child.kill();
});
