// Other DPI tools fight over the same packets (and often over the WinDivert
// driver itself), which is the most common reason "it stopped working" in the
// GoodbyeDPI / zapret issue trackers. We find them and offer to stop them.

import { resolve } from "node:path";
import type { Conflict } from "@shared/types";
import { runPowerShell, runPowerShellJson } from "./powershell";

const PROCESS_NAMES = ["goodbyedpi.exe", "winws.exe", "winws2.exe", "ciadpi.exe", "ProxiFyre.exe"];
const SERVICE_PATH_RE = "goodbyedpi|winws|ciadpi|proxifyre";

const LABELS: Record<string, string> = {
  "goodbyedpi.exe": "GoodbyeDPI",
  "winws.exe": "zapret (winws)",
  "winws2.exe": "zapret2 (winws2)",
  "ciadpi.exe": "ByeDPI",
  "proxifyre.exe": "ProxiFyre",
};

interface RawProcess {
  ProcessId: number;
  Name: string;
  ExecutablePath: string | null;
}

interface RawService {
  Name: string;
  DisplayName: string;
  PathName: string;
}

const SCAN_SCRIPT = `
$names = @(${PROCESS_NAMES.map((n) => `'${n}'`).join(",")})
$p = @(Get-CimInstance Win32_Process | Where-Object { $names -contains $_.Name } | Select-Object ProcessId, Name, ExecutablePath)
$s = @(Get-CimInstance Win32_Service | Where-Object { $_.State -eq 'Running' -and $_.PathName -match '${SERVICE_PATH_RE}' } | Select-Object Name, DisplayName, PathName)
ConvertTo-Json -Compress -Depth 3 -InputObject @{ processes = $p; services = $s }
`;

const asArray = <T>(v: T | T[] | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);

/**
 * Lists foreign DPI tools. Our own winws (same engine directory) is reported
 * separately so a leftover from a crash can be cleaned up without asking.
 */
export async function findConflicts(
  ownEngineDir: string,
  ownPids: ReadonlySet<number>,
): Promise<{ conflicts: Conflict[]; strayOwn: number[] }> {
  const raw = await runPowerShellJson<{ processes: RawProcess | RawProcess[]; services: RawService | RawService[] }>(SCAN_SCRIPT);
  const own = resolve(ownEngineDir).toLowerCase();
  const conflicts: Conflict[] = [];
  const strayOwn: number[] = [];
  const servicePaths: string[] = [];

  for (const s of asArray(raw?.services)) {
    servicePaths.push(s.PathName.toLowerCase());
    conflicts.push({ kind: "service", name: s.Name, ref: s.Name, label: s.DisplayName || s.Name });
  }

  for (const p of asArray(raw?.processes)) {
    if (ownPids.has(p.ProcessId)) continue;
    const path = (p.ExecutablePath ?? "").toLowerCase();
    if (path && resolve(path).toLowerCase().startsWith(own)) {
      strayOwn.push(p.ProcessId);
      continue;
    }
    // A process that belongs to a service is handled through the service.
    if (path && servicePaths.some((sp) => sp.includes(path))) continue;
    conflicts.push({
      kind: "process",
      name: p.Name,
      ref: String(p.ProcessId),
      label: LABELS[p.Name.toLowerCase()] ?? p.Name,
    });
  }
  return { conflicts, strayOwn };
}

/**
 * Stops the given tools. Services are stopped and set to manual start so they
 * don't come back after a reboot, but they are not deleted: the user can still
 * go back to them.
 */
export async function stopConflicts(conflicts: readonly Conflict[]): Promise<void> {
  const lines = ["$ErrorActionPreference = 'Continue'"];
  for (const c of conflicts) {
    if (c.kind === "service" && /^[\w.-]+$/.test(c.ref)) {
      lines.push(`Stop-Service -Name '${c.ref}' -Force -ErrorAction SilentlyContinue`);
      lines.push(`Set-Service -Name '${c.ref}' -StartupType Manual -ErrorAction SilentlyContinue`);
    } else if (c.kind === "process" && /^\d+$/.test(c.ref)) {
      lines.push(`Stop-Process -Id ${c.ref} -Force -ErrorAction SilentlyContinue`);
    }
  }
  await runPowerShell(lines.join("\n"), 30_000);
}

export async function killPids(pids: readonly number[]): Promise<void> {
  if (pids.length === 0) return;
  await runPowerShell(`Stop-Process -Id ${pids.map(Number).join(",")} -Force -ErrorAction SilentlyContinue`).catch(() => undefined);
}
