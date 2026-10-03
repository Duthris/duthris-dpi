import { execFile } from "node:child_process";
import { join } from "node:path";

const POWERSHELL = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");

/**
 * Runs a PowerShell script. The script is passed base64-encoded so no quoting
 * or escaping can ever change what runs.
 */
export function runPowerShell(script: string, timeoutMs = 20_000): Promise<string> {
  // Force UTF-8 output so Turkish network names survive the round trip.
  const full = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n$ErrorActionPreference = 'Stop'\n${script}`;
  const encoded = Buffer.from(full, "utf16le").toString("base64");
  return new Promise((resolve, reject) => {
    execFile(
      POWERSHELL,
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, encoding: "utf8" },
      (err, stdout, stderr) => {
        if (err) reject(new Error((stderr || err.message).trim()));
        else resolve(stdout.trim());
      },
    );
  });
}

export async function runPowerShellJson<T>(script: string, timeoutMs?: number): Promise<T | null> {
  const out = await runPowerShell(script, timeoutMs);
  if (!out) return null;
  return JSON.parse(out) as T;
}

/** Single-quoted PowerShell literal. */
export const psString = (s: string): string => `'${s.replace(/'/g, "''")}'`;
