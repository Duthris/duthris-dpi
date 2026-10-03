// DNS-over-HTTPS client. Providers are addressed by IP so resolving them never
// depends on the (possibly poisoned) system resolver; their certificates carry
// the IP as a SAN, so TLS is still fully verified.

import { isIPv4 } from "node:net";

interface Provider {
  name: string;
  /** RFC 8484 wire-format endpoint. */
  wire: string;
  /** JSON endpoint (Google-style `?name=&type=`), when the provider has one on its IP. */
  json?: string;
}

export const DOH_PROVIDERS: readonly Provider[] = [
  { name: "Cloudflare", wire: "https://1.1.1.1/dns-query", json: "https://1.1.1.1/dns-query" },
  { name: "Google", wire: "https://8.8.8.8/dns-query", json: "https://8.8.8.8/resolve" },
  { name: "Quad9", wire: "https://9.9.9.9/dns-query" },
];

let preferred = 0;

function orderedProviders(): Provider[] {
  const list = [...DOH_PROVIDERS];
  const [first] = list.splice(preferred, 1);
  return first ? [first, ...list] : list;
}

function remember(p: Provider): void {
  preferred = Math.max(0, DOH_PROVIDERS.indexOf(p));
}

interface JsonAnswer {
  Status?: number;
  Answer?: { type: number; data: string }[];
}

/** IPv4 addresses of `host`, or an empty list when it does not exist. Throws only if every provider fails. */
export async function resolveA(host: string, timeoutMs = 4000): Promise<string[]> {
  let lastError: unknown = null;
  for (const p of orderedProviders()) {
    if (!p.json) continue;
    try {
      const url = `${p.json}?name=${encodeURIComponent(host)}&type=A`;
      const res = await fetch(url, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`${p.name}: HTTP ${res.status}`);
      const body = (await res.json()) as JsonAnswer;
      remember(p);
      return (body.Answer ?? []).filter((a) => a.type === 1 && isIPv4(a.data)).map((a) => a.data);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("DoH unavailable");
}

/** Sends a raw DNS message over DoH and returns the raw answer. */
export async function queryWire(message: Buffer, timeoutMs = 4000): Promise<Buffer> {
  let lastError: unknown = null;
  for (const p of orderedProviders()) {
    try {
      const res = await fetch(p.wire, {
        method: "POST",
        headers: { "content-type": "application/dns-message", accept: "application/dns-message" },
        body: new Uint8Array(message),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`${p.name}: HTTP ${res.status}`);
      remember(p);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("DoH unavailable");
}

/** Quick reachability check, used before relying on DoH for anything. */
export async function dohReachable(): Promise<boolean> {
  try {
    await resolveA("one.one.one.one", 3500);
    return true;
  } catch {
    return false;
  }
}
