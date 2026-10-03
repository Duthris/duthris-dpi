import { runPowerShellJson } from "./powershell";

/**
 * Antivirus products known to block the WinDivert driver outright. Kaspersky
 * flags it as "not-a-virus:RiskTool" and blocks it even when disabled.
 */
const BLOCKERS = /kaspersky/i;

export async function findBlockingAntivirus(): Promise<string | null> {
  const names = await runPowerShellJson<string | string[]>(
    "ConvertTo-Json -Compress -InputObject @(Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction SilentlyContinue | Select-Object -ExpandProperty displayName)",
  ).catch(() => null);
  const list = Array.isArray(names) ? names : names ? [names] : [];
  return list.find((n) => BLOCKERS.test(n)) ?? null;
}
