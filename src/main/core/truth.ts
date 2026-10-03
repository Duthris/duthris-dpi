// "Truth" = the real addresses of the hosts we test, obtained in a way the ISP
// can't tamper with. DoH first; if a network blocks DoH, resolvers listening on
// non-standard ports (which ISPs don't intercept) are the fallback.

import { Resolver } from "node:dns/promises";
import { resolveA } from "../net/doh";

const ALT_PORT_RESOLVERS = ["77.88.8.8:1253", "94.140.14.140:5353", "208.67.222.222:5353"];
const TTL_MS = 10 * 60 * 1000;

const cache = new Map<string, { ips: string[]; at: number }>();

async function viaAltPorts(host: string): Promise<string[]> {
  for (const server of ALT_PORT_RESOLVERS) {
    try {
      const r = new Resolver({ timeout: 2500, tries: 1 });
      r.setServers([server]);
      const ips = await r.resolve4(host);
      if (ips.length) return ips;
    } catch {
      // next
    }
  }
  return [];
}

async function resolveOne(host: string): Promise<string[]> {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ips;
  let ips: string[];
  try {
    ips = await resolveA(host);
  } catch {
    ips = await viaAltPorts(host);
  }
  if (ips.length) cache.set(host, { ips, at: Date.now() });
  return ips;
}

/** host -> real IPv4 addresses. Hosts that can't be resolved are left out. */
export async function resolveTruth(hosts: readonly string[]): Promise<Map<string, string[]>> {
  const entries = await Promise.all(hosts.map(async (h) => [h, await resolveOne(h)] as const));
  return new Map(entries.filter(([, ips]) => ips.length > 0));
}

export function clearTruthCache(): void {
  cache.clear();
}

const prefix16 = (ip: string): string => ip.split(".").slice(0, 2).join(".");

// A server that doesn't answer at all is skipped (Windows moves on too);
// "no such name" for a host that exists is a lie.
const LYING_ERRORS = new Set(["ENOTFOUND", "ENODATA"]);

async function serverLies(server: string, truth: ReadonlyMap<string, string[]>): Promise<boolean> {
  const r = new Resolver({ timeout: 2500, tries: 2 });
  try {
    r.setServers([server]);
  } catch {
    return false;
  }
  const verdicts = await Promise.all(
    [...truth].map(async ([host, real]) => {
      let got: string[];
      try {
        got = await r.resolve4(host);
      } catch (err) {
        return LYING_ERRORS.has((err as NodeJS.ErrnoException).code ?? "");
      }
      const realPrefixes = new Set(real.map(prefix16));
      return !got.some((ip) => real.includes(ip) || realPrefixes.has(prefix16(ip)));
    }),
  );
  return verdicts.some(Boolean);
}

/**
 * Asks each of the DNS servers Windows may use and compares with the truth.
 * Poisoned = any of them answers with an address that has nothing to do with
 * the real one (block page, 127.0.0.1, NXDOMAIN...); one lying server is enough,
 * because Windows spreads lookups over all of them.
 * Same /16 is accepted because CDNs legitimately answer with different nodes.
 */
export async function isDnsPoisoned(truth: ReadonlyMap<string, string[]>, systemServers: readonly string[]): Promise<boolean> {
  if (systemServers.length === 0 || truth.size === 0) return false;
  const verdicts = await Promise.all(systemServers.map((s) => serverLies(s, truth)));
  return verdicts.some(Boolean);
}
