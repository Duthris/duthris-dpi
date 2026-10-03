// Finds a strategy that works on the current network.
//
//  1. Real addresses of the test hosts over DoH (DNS can't fool the test).
//  2. Is the ISP's DNS lying? Decides whether the DNS fix is needed.
//  3. Baseline without any bypass: maybe nothing is blocked here.
//  4. Strategies in the order most likely to work for this ISP, each verified
//     with real TLS handshakes + HTTP requests to the test hosts.

import type { ScanProgress, StrategyResult } from "@shared/types";
import { scanOrder, type IspFamily, type Strategy } from "@shared/strategies";
import { buildWinwsArgs } from "../engine/args";
import { WinwsProcess, EngineError } from "../engine/winws";
import { probeAll } from "../net/probe";
import { log } from "../logger";
import { isDnsPoisoned, resolveTruth } from "./truth";

export interface ScanInput {
  family: IspFamily;
  proven: readonly string[];
  probeHosts: readonly string[];
  engineDir: string;
  hostlistFile: string;
  systemDns: readonly string[];
  full: boolean;
  signal: AbortSignal;
  onProgress: (p: ScanProgress) => void;
}

export interface ScanOutcome {
  strategyId: string;
  dnsPoisoned: boolean;
  results: StrategyResult[];
  partial: boolean;
}

export class ScanError extends Error {
  constructor(
    readonly code: "dns-unavailable" | "no-strategy" | "aborted",
    message: string,
  ) {
    super(message);
  }
}

const SETTLE_MS = 250;
const PROBE_TIMEOUT_MS = 4500;

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) throw new ScanError("aborted", "scan cancelled");
}

export async function scanNetwork(input: ScanInput): Promise<ScanOutcome> {
  const { signal } = input;

  input.onProgress({ index: 0, total: 0, strategyName: "", stage: "dns" });
  const truth = await resolveTruth(input.probeHosts);
  if (truth.size === 0) throw new ScanError("dns-unavailable", "could not resolve any test host");
  log.info("scan", `test hosts: ${[...truth.keys()].join(", ")}`);
  checkAbort(signal);

  const dnsPoisoned = await isDnsPoisoned(truth, input.systemDns).catch(() => false);
  log.info("scan", dnsPoisoned ? "the ISP's DNS returns fake addresses, DNS protection will be used" : "the ISP's DNS answers correctly");
  checkAbort(signal);

  input.onProgress({ index: 0, total: 0, strategyName: "", stage: "baseline" });
  const baseline = await probeAll(truth, PROBE_TIMEOUT_MS);
  const baselinePassed = baseline.filter((r) => r.ok).length;
  log.info("scan", `without bypass: ${baselinePassed}/${truth.size} reachable`);
  if (baselinePassed === truth.size) {
    return {
      strategyId: "none",
      dnsPoisoned,
      results: [{ strategyId: "none", passed: baselinePassed, total: truth.size, ms: 0 }],
      partial: false,
    };
  }

  const order = scanOrder(input.family, input.proven);
  const results: StrategyResult[] = [];
  let best: { s: Strategy; r: StrategyResult } | null = null;

  for (const [i, strategy] of order.entries()) {
    checkAbort(signal);
    input.onProgress({ index: i + 1, total: order.length, strategyName: strategy.name, stage: "strategies" });

    const engine = new WinwsProcess(input.engineDir, () => undefined);
    const started = Date.now();
    try {
      await engine.start(
        buildWinwsArgs({
          strategy: strategy.args,
          engineDir: input.engineDir,
          hostlist: input.hostlistFile,
          exclude: null,
          voice: false,
        }),
      );
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      const probes = await probeAll(truth, PROBE_TIMEOUT_MS);
      const r: StrategyResult = {
        strategyId: strategy.id,
        passed: probes.filter((p) => p.ok).length,
        total: truth.size,
        ms: Date.now() - started,
      };
      results.push(r);
      const failed = probes.filter((p) => !p.ok).map((p) => `${p.host} (${p.error ?? "?"})`);
      log.info("scan", `${strategy.name}: ${r.passed}/${r.total}${failed.length ? ` — failed: ${failed.join(", ")}` : ""}`);
      if (!best || r.passed > best.r.passed) best = { s: strategy, r };
      if (r.passed === r.total && !input.full) break;
    } catch (err) {
      // A driver problem won't fix itself with the next strategy.
      if (err instanceof EngineError && err.code !== "engine-failed") throw err;
      log.warn("scan", `${strategy.name}: engine error — ${(err as Error).message}`);
    } finally {
      await engine.stop();
    }
  }

  if (!best || best.r.passed === 0) {
    throw new ScanError("no-strategy", "no strategy got through on this network");
  }
  if (input.full) {
    // Fastest among the fully working ones.
    const full = results.filter((r) => r.passed === r.total).sort((a, b) => a.ms - b.ms)[0];
    if (full) return { strategyId: full.strategyId, dnsPoisoned, results, partial: false };
  }
  return { strategyId: best.s.id, dnsPoisoned, results, partial: best.r.passed < best.r.total };
}
