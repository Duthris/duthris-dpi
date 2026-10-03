import { createHash } from "node:crypto";
import { networkInterfaces } from "node:os";
import { runPowerShellJson } from "../system/powershell";

interface RawRoute {
  ifIndex?: number;
  gateway?: string;
  mac?: string | null;
  name?: string | null;
  alias?: string | null;
}

export interface CurrentNetwork {
  id: string;
  name: string;
  ifIndex: number;
  gateway: string;
}

const ROUTE_SCRIPT = `
$r = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
  Where-Object { $_.NextHop -ne '0.0.0.0' } |
  Sort-Object { $_.RouteMetric + (Get-NetIPInterface -InterfaceIndex $_.ifIndex -AddressFamily IPv4).InterfaceMetric } |
  Select-Object -First 1
if (-not $r) { exit 0 }
$nb = Get-NetNeighbor -IPAddress $r.NextHop -ErrorAction SilentlyContinue | Select-Object -First 1
$pr = Get-NetConnectionProfile -InterfaceIndex $r.ifIndex -ErrorAction SilentlyContinue | Select-Object -First 1
[pscustomobject]@{
  ifIndex = $r.ifIndex
  gateway = $r.NextHop
  mac = $nb.LinkLayerAddress
  name = $pr.Name
  alias = $r.InterfaceAlias
} | ConvertTo-Json -Compress
`;

/**
 * Identifies the network we are on by its default gateway. The gateway's MAC is
 * unique per router, so "home Wi-Fi" and "office Ethernet" get different ids even
 * when both use 192.168.1.1.
 */
export async function detectNetwork(): Promise<CurrentNetwork | null> {
  const raw = await runPowerShellJson<RawRoute>(ROUTE_SCRIPT).catch(() => null);
  if (!raw?.gateway || raw.ifIndex === undefined) return null;
  const mac = raw.mac && raw.mac !== "00-00-00-00-00-00" ? raw.mac : "";
  const key = mac ? `mac:${mac}` : `gw:${raw.gateway}|${raw.name ?? raw.alias ?? ""}`;
  return {
    id: createHash("sha256").update(key).digest("hex").slice(0, 16),
    name: raw.name || raw.alias || raw.gateway,
    ifIndex: raw.ifIndex,
    gateway: raw.gateway,
  };
}

/** ISP name, e.g. "AS34984 Turkcell Superonline". Best effort, null on failure. */
export async function lookupIsp(): Promise<string | null> {
  const sources: [string, (j: Record<string, unknown>) => unknown][] = [
    ["https://ipinfo.io/json", (j) => j.org],
    ["https://ipwho.is/?fields=connection", (j) => {
      const c = j.connection as Record<string, unknown> | undefined;
      return c ? `AS${String(c.asn)} ${String(c.isp ?? c.org ?? "")}` : null;
    }],
  ];
  for (const [url, pick] of sources) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { accept: "application/json" } });
      if (!res.ok) continue;
      const value = pick((await res.json()) as Record<string, unknown>);
      if (typeof value === "string" && value.trim()) return value.trim();
    } catch {
      // try the next source
    }
  }
  return null;
}

/** Cheap signature of the local interfaces; changes when a network comes or goes. */
export function interfaceSignature(): string {
  const parts: string[] = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (!a.internal && a.family === "IPv4") parts.push(`${name}=${a.address}/${a.mac}`);
    }
  }
  return parts.sort().join(";");
}

/**
 * Calls `onChange` (debounced) whenever the set of local addresses changes:
 * Wi-Fi switch, cable plugged in, VPN up, waking up on another network.
 */
export function watchInterfaces(onChange: () => void, intervalMs = 4000, debounceMs = 2500): () => void {
  let last = interfaceSignature();
  let debounce: NodeJS.Timeout | null = null;
  const timer = setInterval(() => {
    const now = interfaceSignature();
    if (now === last) return;
    last = now;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(onChange, debounceMs);
  }, intervalMs);
  return () => {
    clearInterval(timer);
    if (debounce) clearTimeout(debounce);
  };
}
