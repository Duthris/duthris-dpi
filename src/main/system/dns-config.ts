// Points the active adapters' DNS at the local forwarder and restores them
// exactly afterwards (static servers stay static, DHCP stays DHCP).
//
// The original servers are kept as fallbacks behind 127.0.0.1, so if the app is
// killed the machine still resolves names; the backup file lets the next start
// undo the change.

import { join } from "node:path";
import { readJson, removeFile, writeJson } from "../json-store";
import { dataDir } from "../paths";
import { runPowerShell, runPowerShellJson } from "./powershell";

interface AdapterDns {
  ifIndex: number;
  guid: string;
  alias: string;
  static4: string;
  static6: string;
  effective4: string[];
  effective6: string[];
}

interface Backup {
  createdAt: number;
  adapters: AdapterDns[];
}

const backupFile = (): string => join(dataDir(), "dns-backup.json");

const LOOPBACK = new Set(["127.0.0.1", "::1"]);

const SNAPSHOT_SCRIPT = `
$out = @()
$idx = @(Get-NetRoute -DestinationPrefix '0.0.0.0/0','::/0' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ifIndex -Unique)
foreach ($i in $idx) {
  $ad = Get-NetAdapter -InterfaceIndex $i -ErrorAction SilentlyContinue
  if (-not $ad -or $ad.Status -ne 'Up') { continue }
  $g = $ad.InterfaceGuid
  $v4 = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\$g" -Name NameServer -ErrorAction SilentlyContinue).NameServer
  $v6 = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip6\\Parameters\\Interfaces\\$g" -Name NameServer -ErrorAction SilentlyContinue).NameServer
  $e4 = @((Get-DnsClientServerAddress -InterfaceIndex $i -AddressFamily IPv4 -ErrorAction SilentlyContinue).ServerAddresses)
  $e6 = @((Get-DnsClientServerAddress -InterfaceIndex $i -AddressFamily IPv6 -ErrorAction SilentlyContinue).ServerAddresses)
  $out += [pscustomobject]@{ ifIndex = $i; guid = "$g"; alias = $ad.Name; static4 = "$v4"; static6 = "$v6"; effective4 = $e4; effective6 = $e6 }
}
ConvertTo-Json -Compress -Depth 4 -InputObject @($out)
`;

// Everything interpolated into a script is validated first, even though it
// comes from the system itself.
const IP_RE = /^[0-9a-fA-F:.]{2,45}$/;
const GUID_RE = /^\{?[0-9a-fA-F-]{36}\}?$/;

const asList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : v ? [v] : []).map(String).filter((s) => IP_RE.test(s) && !s.startsWith("fec0:"));

const splitStatic = (s: string): string[] => s.split(/[\s,]+/).filter((x) => IP_RE.test(x));

async function snapshot(): Promise<AdapterDns[]> {
  const raw = await runPowerShellJson<unknown[]>(SNAPSHOT_SCRIPT);
  return (raw ?? [])
    .map((r) => {
      const o = r as Record<string, unknown>;
      return {
        ifIndex: Number(o.ifIndex),
        guid: String(o.guid ?? ""),
        alias: String(o.alias ?? ""),
        static4: String(o.static4 ?? ""),
        static6: String(o.static6 ?? ""),
        effective4: asList(o.effective4),
        effective6: asList(o.effective6),
      };
    })
    .filter((a) => Number.isInteger(a.ifIndex) && GUID_RE.test(a.guid));
}

/** The IPv4 DNS servers Windows uses (or used, before we redirected it). */
export async function originalDnsServers(): Promise<string[]> {
  const backup = readJson<Backup | null>(backupFile(), null);
  const adapters = backup?.adapters ?? (await snapshot().catch(() => []));
  return [...new Set(adapters.flatMap((a) => a.effective4).filter((s) => !LOOPBACK.has(s)))];
}

/**
 * Every DNS server Windows may ask, IPv4 and IPv6. Windows doesn't stick to the
 * first one, so a router's IPv6 server (often fe80::1) next to a manually set
 * 1.1.1.1 still answers some lookups. Link-local ones get the adapter's scope.
 */
export async function allDnsServers(): Promise<string[]> {
  const backup = readJson<Backup | null>(backupFile(), null);
  const adapters = backup?.adapters ?? (await snapshot().catch(() => []));
  const servers = adapters.flatMap((a) => [
    ...a.effective4,
    ...a.effective6.map((s) => (/^fe80:/i.test(s) && !s.includes("%") ? `${s}%${a.ifIndex}` : s)),
  ]);
  return [...new Set(servers.filter((s) => !LOOPBACK.has(s)))];
}

export function hasPendingBackup(): boolean {
  return readJson<Backup | null>(backupFile(), null) !== null;
}

/**
 * Redirects DNS to 127.0.0.1 / ::1 on every adapter that has a default route.
 * Returns the original servers, which the forwarder uses for unprotected names.
 */
export async function applyLocalDns(): Promise<string[]> {
  // If a previous run left a backup behind, it holds the true originals.
  const previous = readJson<Backup | null>(backupFile(), null);
  const current = await snapshot();
  const adapters = current.map((a) => previous?.adapters.find((p) => p.guid === a.guid) ?? a);
  if (adapters.length === 0) throw new Error("no active network adapter");
  writeJson(backupFile(), { createdAt: Date.now(), adapters } satisfies Backup);

  const upstream = new Set<string>();
  const lines: string[] = [];
  for (const a of adapters) {
    const fallback4 = a.effective4.filter((s) => !LOOPBACK.has(s));
    fallback4.forEach((s) => upstream.add(s));
    const servers = ["127.0.0.1", ...fallback4.slice(0, 1), "::1"];
    lines.push(
      `Set-DnsClientServerAddress -InterfaceIndex ${a.ifIndex} -ServerAddresses @(${servers.map((s) => `'${s}'`).join(",")})`,
    );
  }
  lines.push("Clear-DnsClientCache");
  await runPowerShell(lines.join("\n"));
  return [...upstream];
}

/** Puts every adapter back the way it was. Safe to call when nothing was changed. */
export async function restoreDns(): Promise<void> {
  const backup = readJson<Backup | null>(backupFile(), null);
  if (!backup) return;
  const lines: string[] = ["$ErrorActionPreference = 'Continue'"];
  for (const a of backup.adapters) {
    // Indexes can change when an adapter is re-created; the GUID can't.
    lines.push(
      `$ad = Get-NetAdapter -IncludeHidden -ErrorAction SilentlyContinue | Where-Object { "$($_.InterfaceGuid)" -eq '${a.guid}' } | Select-Object -First 1`,
      `if ($ad) {`,
      `  Set-DnsClientServerAddress -InterfaceIndex $ad.ifIndex -ResetServerAddresses`,
    );
    const statics = [...splitStatic(a.static4), ...splitStatic(a.static6)];
    if (statics.length) {
      lines.push(`  Set-DnsClientServerAddress -InterfaceIndex $ad.ifIndex -ServerAddresses @(${statics.map((s) => `'${s}'`).join(",")})`);
    }
    lines.push("}");
  }
  lines.push("Clear-DnsClientCache");
  await runPowerShell(lines.join("\n"));
  removeFile(backupFile());
}

export async function flushDnsCache(): Promise<void> {
  await runPowerShell("Clear-DnsClientCache").catch(() => undefined);
}
