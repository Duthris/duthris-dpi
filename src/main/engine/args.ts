import { join } from "node:path";

export interface EngineConfig {
  /** TCP strategy arguments (from the catalog or the user). */
  strategy: readonly string[];
  engineDir: string;
  /** File with the domains to act on; null = every site. */
  hostlist: string | null;
  /** File with domains never to touch; used in "every site" mode. */
  exclude: string | null;
  /** Discord voice/video over UDP. */
  voice: boolean;
}

const VOICE_PORTS = "19294-19344,50000-50100";

/** Replaces `{engine}/file` placeholders with absolute paths. */
export function expandPlaceholders(args: readonly string[], engineDir: string): string[] {
  return args.map((a) => a.replace(/\{engine\}[\\/]([\w.-]+)/g, (_, file: string) => join(engineDir, file)));
}

/**
 * Builds the full winws command line:
 *  1. HTTP/HTTPS with the chosen strategy,
 *  2. QUIC (HTTP/3) with a fake initial, so browsers and the Discord client
 *     don't stall on UDP before falling back to TCP,
 *  3. Discord voice: a fake before the IP discovery / STUN packet.
 * Profiles are separated by `--new`; the first one that matches a packet wins.
 */
export function buildWinwsArgs(cfg: EngineConfig): string[] {
  const scope = [
    ...(cfg.hostlist ? [`--hostlist=${cfg.hostlist}`] : []),
    ...(cfg.exclude ? [`--hostlist-exclude=${cfg.exclude}`] : []),
  ];
  const quicFake = join(cfg.engineDir, "quic_initial_www_google_com.bin");

  const args = [
    "--wf-tcp=80,443",
    `--wf-udp=443${cfg.voice ? `,${VOICE_PORTS}` : ""}`,

    "--filter-tcp=80,443",
    ...scope,
    ...expandPlaceholders(cfg.strategy, cfg.engineDir),
    "--new",

    "--filter-udp=443",
    ...scope,
    "--dpi-desync=fake",
    "--dpi-desync-repeats=6",
    `--dpi-desync-fake-quic=${quicFake}`,
  ];

  if (cfg.voice) {
    args.push(
      "--new",
      `--filter-udp=${VOICE_PORTS}`,
      "--filter-l7=discord,stun",
      "--dpi-desync=fake",
      "--dpi-desync-repeats=6",
    );
  }
  return args;
}

/** Splits a user-typed argument string, honouring "double quotes". */
export function splitArgs(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  for (let m = re.exec(input); m; m = re.exec(input)) out.push(m[1] ?? m[2] ?? "");
  return out.filter(Boolean);
}

/** Only desync/fooling options are accepted from users; window filters and profiles are ours. */
export function sanitizeCustomArgs(args: readonly string[]): { ok: string[]; rejected: string[] } {
  const ok: string[] = [];
  const rejected: string[] = [];
  for (const a of args) {
    if (/^--(dpi-desync|dup|orig|ip-id|hostcase|hostspell|hostnospace|domcase|methodeol|synack-split|wssize)/.test(a)) ok.push(a);
    else rejected.push(a);
  }
  return { ok, rejected };
}
