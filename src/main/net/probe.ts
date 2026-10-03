// Checks whether an HTTPS site is reachable *through the DPI*, independent of
// DNS: we connect to an IP we got over DoH, send the real hostname in SNI (which
// is exactly what the DPI inspects) and wait for an HTTP answer. The certificate
// is verified, so a block page or a hijacked IP never counts as success.
//
// Every host is checked with two TLS ClientHellos, because the DPI (and the
// engine's desync) can treat them differently:
//  - "large": Electron's default, with a post-quantum key share (~1.5 KB). It
//    spans two TCP segments, like Chromium-based clients (Discord's window).
//  - "small": classic key shares only (~520 bytes, one segment), like Schannel
//    and most native clients (Discord's updater, curl).

import { connect } from "node:tls";

export interface ProbeResult {
  host: string;
  ok: boolean;
  ms: number;
  error?: string;
}

type Hello = "large" | "small";

const SMALL_HELLO_CURVES = "X25519:P-256:P-384";

export function probeHttps(host: string, ip: string, timeoutMs = 5000, hello: Hello = "large"): Promise<ProbeResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean, error?: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({ host, ok, ms: Date.now() - started, ...(ok ? {} : { error }) });
    };

    const socket = connect({
      host: ip,
      port: 443,
      servername: host,
      ALPNProtocols: ["http/1.1"],
      rejectUnauthorized: true,
      ...(hello === "small" ? { ecdhCurve: SMALL_HELLO_CURVES } : {}),
    });

    const timer = setTimeout(() => finish(false, "timeout"), timeoutMs);

    socket.once("secureConnect", () => {
      socket.write(`HEAD / HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`);
    });
    socket.once("data", (chunk: Buffer) => {
      finish(chunk.subarray(0, 5).toString("latin1") === "HTTP/", "unexpected response");
    });
    socket.once("error", (err: NodeJS.ErrnoException) => finish(false, err.code ?? err.message));
    socket.once("end", () => finish(false, "closed"));
  });
}

/** One host, one kind of ClientHello, retried once (a single lost packet should not disqualify a strategy). */
async function probeWithRetry(host: string, ips: readonly string[], timeoutMs: number, hello: Hello): Promise<ProbeResult> {
  let last: ProbeResult = { host, ok: false, ms: 0, error: "no address" };
  for (let attempt = 0; attempt < 2; attempt++) {
    const ip = ips[attempt % Math.max(1, ips.length)];
    if (!ip) break;
    last = await probeHttps(host, ip, timeoutMs, hello);
    if (last.ok) break;
  }
  return last;
}

/**
 * Probes every host with both ClientHello sizes; a host only counts when both
 * get through. `targets` maps host -> IPs resolved over DoH.
 */
export async function probeAll(targets: ReadonlyMap<string, readonly string[]>, timeoutMs = 5000): Promise<ProbeResult[]> {
  const jobs = [...targets].map(async ([host, ips]): Promise<ProbeResult> => {
    const [large, small] = await Promise.all([
      probeWithRetry(host, ips, timeoutMs, "large"),
      probeWithRetry(host, ips, timeoutMs, "small"),
    ]);
    const ms = Math.max(large.ms, small.ms);
    if (large.ok && small.ok) return { host, ok: true, ms };
    const errors = [large.ok ? null : `large hello: ${large.error}`, small.ok ? null : `small hello: ${small.error}`];
    return { host, ok: false, ms, error: errors.filter(Boolean).join(", ") };
  });
  return Promise.all(jobs);
}
