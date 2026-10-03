import { app } from "electron";
import { run } from "./exec";
import { psString, runPowerShell } from "./powershell";

let cached: boolean | null = null;

/**
 * Exit code of a copy that handed over to an elevated one. `scripts/dev.mjs`
 * keeps the Vite dev server running on it, since the new copy loads from there.
 */
export const HANDOFF_EXIT_CODE = 75;

/** `net session` only succeeds for an elevated token. */
export async function isElevated(): Promise<boolean> {
  if (cached === null) cached = (await run("net", ["session"], 5000)).code === 0;
  return cached;
}

/**
 * Starts a new elevated copy of the app (UAC prompt) and quits this one.
 * The packaged app always runs elevated through its manifest, so this is mostly
 * for development and for builds started without the manifest.
 */
export async function relaunchAsAdmin(extraArgs: string[] = []): Promise<boolean> {
  const args = app.isPackaged ? [] : [app.getAppPath()];
  const devServer = process.env.DPI_DEV_SERVER;
  // Environment variables do not survive the UAC hop, so pass it as an argument.
  if (devServer) args.push(`--dev-server=${devServer}`);
  args.push(...extraArgs);

  const argList = args.length ? ` -ArgumentList @(${args.map((a) => psString(`"${a}"`)).join(",")})` : "";
  try {
    await runPowerShell(`Start-Process -FilePath ${psString(process.execPath)}${argList} -Verb RunAs`, 60_000);
    return true;
  } catch {
    // The user dismissed the UAC prompt.
    return false;
  }
}
