// After the bypass comes up, a Discord client that already failed keeps
// waiting on "Checking for updates..." or a stale connection. Restarting it is
// the fix every guide recommends, so we do it for the user.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { runPowerShell } from "./powershell";

const FLAVORS = [
  { process: "Discord", shortcut: "Discord.lnk" },
  { process: "DiscordPTB", shortcut: "Discord PTB.lnk" },
  { process: "DiscordCanary", shortcut: "Discord Canary.lnk" },
] as const;

function shortcutPath(file: string): string {
  return join(process.env.APPDATA ?? "", "Microsoft", "Windows", "Start Menu", "Programs", "Discord Inc", file);
}

/** Returns false when no Discord installation was found. */
export async function restartDiscord(): Promise<boolean> {
  const running = await runPowerShell(
    `@(Get-Process -Name ${FLAVORS.map((f) => `'${f.process}'`).join(",")} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessName -Unique) -join ','`,
  ).catch(() => "");
  const runningSet = new Set(running.split(",").filter(Boolean));

  const targets = FLAVORS.filter((f) => runningSet.has(f.process));
  const toLaunch = targets.length > 0 ? targets : FLAVORS.filter((f) => existsSync(shortcutPath(f.shortcut))).slice(0, 1);
  if (toLaunch.length === 0) return false;

  if (targets.length > 0) {
    await runPowerShell(
      `Stop-Process -Name ${targets.map((f) => `'${f.process}'`).join(",")} -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 800`,
    ).catch(() => undefined);
  }

  for (const f of toLaunch) {
    const lnk = shortcutPath(f.shortcut);
    if (!existsSync(lnk)) continue;
    // We run elevated; launching through Explorer starts Discord as the normal
    // user instead of inheriting our administrator token.
    spawn(join(process.env.SystemRoot ?? "C:\\Windows", "explorer.exe"), [lnk], {
      detached: true,
      stdio: "ignore",
    }).unref();
  }
  return true;
}
