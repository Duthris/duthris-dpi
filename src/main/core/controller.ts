import { EventEmitter } from "node:events";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { app, powerMonitor } from "electron";
import { ispFamily, strategyById } from "@shared/strategies";
import { hostMatches, serviceById, SERVICES, type TargetService } from "@shared/targets";
import type { AppError, AppStatus, ErrorCode, NetworkProfile, Settings } from "@shared/types";
import type { I18nKey } from "@shared/i18n";
import { buildWinwsArgs, sanitizeCustomArgs, splitArgs } from "../engine/args";
import { EngineError, engineFilesPresent, WinwsProcess } from "../engine/winws";
import { DnsProxy } from "../net/dns-proxy";
import { detectNetwork, lookupIsp, watchInterfaces, type CurrentNetwork } from "../net/network";
import { probeAll } from "../net/probe";
import { log } from "../logger";
import { engineDir, runtimeDir } from "../paths";
import { findBlockingAntivirus } from "../system/antivirus";
import { findConflicts, killPids, stopConflicts } from "../system/conflicts";
import { allDnsServers, applyLocalDns, flushDnsCache, hasPendingBackup, originalDnsServers, restoreDns } from "../system/dns-config";
import { isElevated } from "../system/elevation";
import { runPowerShell } from "../system/powershell";
import { getProfile, provenStrategies, saveProfile, touchProfile } from "../state/networks";
import { getSettings } from "../state/settings";
import { ScanError, scanNetwork } from "./scanner";
import { isDnsPoisoned, resolveTruth } from "./truth";

class FlowError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

interface Lists {
  hostlist: string;
  scanHostlist: string;
  exclude: string;
  domains: string[];
  probeHosts: string[];
}

interface ConnectOptions {
  forceScan?: boolean;
  full?: boolean;
  /** Re-connecting because something broke; tell the user when it's fixed. */
  healing?: boolean;
  /** Already rescanned once in this attempt; don't loop. */
  rescanned?: boolean;
}

export interface Notice {
  title: I18nKey;
  body: I18nKey;
  vars?: Record<string, string>;
}

const HEALTH_INTERVAL_MS = 10 * 60 * 1000;
const HEALTH_RECHECK_MS = 20 * 1000;
const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 5 * 60 * 1000;

export class Controller extends EventEmitter<{ status: [AppStatus]; notice: [Notice] }> {
  readonly status: AppStatus = {
    phase: "idle",
    wantsActive: false,
    elevated: false,
    packaged: app.isPackaged,
    version: app.getVersion(),
    network: null,
    profile: null,
    activeStrategy: null,
    dnsActive: false,
    scan: null,
    conflicts: [],
    error: null,
    connectedSince: null,
    warnings: [],
  };

  private engine: WinwsProcess | null = null;
  private readonly dns = new DnsProxy();
  private dohMatcher: (name: string) => boolean = () => false;
  private queue: Promise<void> = Promise.resolve();
  private opAbort: AbortController | null = null;
  private healthTimer: NodeJS.Timeout | null = null;
  private stopWatching: (() => void) | null = null;
  private restarts: number[] = [];
  private lastNetworkId: string | null = null;

  async init(): Promise<void> {
    this.status.elevated = await isElevated();
    this.emitStatus();

    if (this.status.elevated && hasPendingBackup()) {
      // The previous run didn't get to clean up (crash, power loss).
      log.warn("dns", "restoring DNS settings left over from the previous session");
      await restoreDns().catch((err: Error) => log.error("dns", `restore failed: ${err.message}`));
    }

    void findBlockingAntivirus().then((av) => {
      if (av) {
        log.warn("app", `blocking antivirus detected: ${av}`);
        this.setWarning("kaspersky", true);
      }
    });

    void detectNetwork().then(async (net) => {
      if (!net || this.status.network) return;
      this.showNetwork(net, getProfile(net.id)?.isp ?? null);
      const shown = (): AppStatus["network"] => this.status.network;
      if (!shown()?.isp && getSettings().ispLookup) {
        const isp = await lookupIsp();
        const current = shown();
        if (isp && current?.id === net.id && !current.isp) this.showNetwork(net, isp);
      }
    });

    this.stopWatching = watchInterfaces(() => this.onNetworkChange());
    powerMonitor.on("resume", () => setTimeout(() => this.onNetworkChange(), 4000));
  }

  private get wantActive(): boolean {
    return this.status.wantsActive;
  }

  private set wantActive(on: boolean) {
    if (this.status.wantsActive !== on) this.set({ wantsActive: on });
  }

  connect(opts: ConnectOptions = {}): Promise<void> {
    this.wantActive = true;
    return this.enqueue((signal) => this.connectFlow(signal, opts));
  }

  rescan(full = false): Promise<void> {
    return this.connect({ forceScan: true, full });
  }

  disconnect(): Promise<void> {
    this.wantActive = false;
    return this.enqueue(async () => {
      this.set({ phase: "stopping" });
      await this.stopAll();
      this.set({ phase: "idle", error: null, scan: null });
    });
  }

  resolveConflicts(): Promise<void> {
    const conflicts = this.status.conflicts;
    this.wantActive = true;
    return this.enqueue(async (signal) => {
      this.set({ phase: "preparing", error: null });
      log.info("app", `stopping: ${conflicts.map((c) => c.label).join(", ")}`);
      await stopConflicts(conflicts);
      // Give WinDivert a moment to unload the other tool's driver instance.
      await new Promise((r) => setTimeout(r, 1500));
      this.set({ conflicts: [] });
      await this.connectFlow(signal, {});
    });
  }

  /** Called after settings change; re-applies only what is affected. */
  onSettingsChanged(prev: Settings, next: Settings): void {
    const affects =
      prev.allTraffic !== next.allTraffic ||
      prev.voice !== next.voice ||
      prev.dnsMode !== next.dnsMode ||
      JSON.stringify(prev.services) !== JSON.stringify(next.services) ||
      JSON.stringify(prev.customDomains) !== JSON.stringify(next.customDomains) ||
      JSON.stringify(prev.excludeDomains) !== JSON.stringify(next.excludeDomains) ||
      JSON.stringify(prev.strategy) !== JSON.stringify(next.strategy);
    if (affects && this.wantActive) void this.connect();
    if (!prev.selfHeal && next.selfHeal && this.status.phase === "active") this.startHealth();
    this.emitStatus();
  }

  dismissWarning(code: string): void {
    this.setWarning(code, false);
  }

  /** Stops everything and restores the system. Used on quit. */
  async shutdown(): Promise<void> {
    this.wantActive = false;
    this.opAbort?.abort();
    this.stopWatching?.();
    await this.queue.catch(() => undefined);
    await this.stopAll();
  }

  /* ---------------------------------------------------------------- flows */

  private enqueue(task: (signal: AbortSignal) => Promise<void>): Promise<void> {
    this.opAbort?.abort();
    const ac = new AbortController();
    this.opAbort = ac;
    this.queue = this.queue
      .catch(() => undefined)
      .then(() => (ac.signal.aborted ? undefined : task(ac.signal)))
      .catch((err: unknown) => this.fail(err, ac.signal));
    return this.queue;
  }

  private async connectFlow(signal: AbortSignal, opts: ConnectOptions): Promise<void> {
    const s = getSettings();
    this.set({ phase: opts.healing ? "healing" : "preparing", error: null, scan: null });
    this.setWarning("partial", false);

    if (!this.status.elevated) throw new FlowError("not-elevated");
    const dir = engineDir();
    if (!engineFilesPresent(dir)) throw new FlowError("engine-missing");

    this.stopHealth();
    await this.stopEngine();

    const { conflicts, strayOwn } = await findConflicts(dir, new Set());
    if (strayOwn.length) {
      log.info("app", `cleaning up ${strayOwn.length} leftover engine process(es)`);
      await killPids(strayOwn);
    }
    if (conflicts.length) {
      this.set({ conflicts });
      throw new FlowError("conflict", conflicts.map((c) => c.label).join(", "));
    }
    this.set({ conflicts: [] });
    this.abortCheck(signal);

    const net = await detectNetwork();
    if (!net) {
      await this.stopDns();
      this.set({ phase: "waiting-network", network: null, activeStrategy: null, connectedSince: null });
      log.info("app", "no network yet, waiting");
      return;
    }
    let profile = getProfile(net.id);
    const isp = profile?.isp ?? (s.ispLookup ? await lookupIsp() : null);
    this.showNetwork(net, isp);
    this.lastNetworkId = net.id;
    this.abortCheck(signal);

    const lists = this.writeLists(s);
    let strategyArgs: string[] | null;
    let activeStrategy: string;
    let dnsPoisoned: boolean;

    if (s.strategy.kind === "auto") {
      if (!profile || opts.forceScan) {
        if (!profile) this.emit("notice", { title: "notify.newNetwork.title", body: "notify.newNetwork.body", vars: { network: net.name } });
        profile = await this.scan(net, isp, lists, !!opts.full, signal);
      }
      activeStrategy = profile.strategyId;
      strategyArgs = profile.strategyId === "none" ? null : [...(strategyById(profile.strategyId)?.args ?? [])];
      if (profile.strategyId !== "none" && !strategyById(profile.strategyId)) {
        // A strategy removed in an update: scan again.
        profile = await this.scan(net, isp, lists, false, signal);
        activeStrategy = profile.strategyId;
        strategyArgs = profile.strategyId === "none" ? null : [...(strategyById(profile.strategyId)?.args ?? [])];
      }
      // The adapter's DNS servers can change without the network changing
      // (router settings, a manual 1.1.1.1), so a clean result is re-checked.
      dnsPoisoned = profile.dnsNeeded || (s.dnsMode === "auto" && (await this.quickDnsCheck(lists.probeHosts)));
    } else {
      if (s.strategy.kind === "preset") {
        const preset = strategyById(s.strategy.id);
        if (!preset) throw new FlowError("no-strategy", `unknown method ${s.strategy.id}`);
        strategyArgs = [...preset.args];
        activeStrategy = preset.id;
      } else {
        const { ok, rejected } = sanitizeCustomArgs(splitArgs(s.strategy.args));
        if (rejected.length) log.warn("app", `ignored custom arguments: ${rejected.join(" ")}`);
        if (ok.length === 0) throw new FlowError("no-strategy", "custom method has no usable arguments");
        strategyArgs = ok;
        activeStrategy = "custom";
      }
      dnsPoisoned = profile?.dnsNeeded ?? (await this.quickDnsCheck(lists.probeHosts));
    }
    this.abortCheck(signal);

    const dnsWanted = s.dnsMode === "always" || (s.dnsMode === "auto" && dnsPoisoned);
    await this.start(strategyArgs, dnsWanted, lists, s);
    this.abortCheck(signal);

    const working = await this.verify(lists.probeHosts);
    if (!working && s.strategy.kind === "auto" && !opts.rescanned) {
      log.warn("app", "the remembered method no longer works here, scanning again");
      return this.connectFlow(signal, { ...opts, forceScan: true, rescanned: true, healing: true });
    }
    if (!working) {
      log.warn("app", "connected, but the test hosts still don't answer");
      this.setWarning("partial", true);
    }

    touchProfile(net.id);
    this.set({
      phase: "active",
      profile: getProfile(net.id),
      activeStrategy,
      connectedSince: Date.now(),
      scan: null,
    });
    log.info("app", `active on "${net.name}" with ${activeStrategy}${this.status.dnsActive ? " + DNS protection" : ""}`);

    if (opts.healing) {
      this.emit("notice", { title: "notify.healed.title", body: "notify.healed.body", vars: { network: net.name } });
    } else {
      this.emit("notice", { title: "notify.connected.title", body: "notify.connected.body", vars: { network: net.name } });
    }

    if (s.services.includes("discord")) void this.checkDiscordOpen();
    this.startHealth();
  }

  private async scan(
    net: CurrentNetwork,
    isp: string | null,
    lists: Lists,
    full: boolean,
    signal: AbortSignal,
  ): Promise<NetworkProfile> {
    // Scanning means testing with and without the bypass; our DNS redirect would only get in the way.
    await this.stopDns();
    this.set({ phase: this.status.phase === "healing" ? "healing" : "scanning" });
    const family = ispFamily(isp);
    log.info("scan", `scanning "${net.name}" (${isp ?? "ISP unknown"}, profile: ${family}${full ? ", full" : ""})`);

    const outcome = await scanNetwork({
      family,
      proven: provenStrategies(),
      probeHosts: lists.probeHosts,
      engineDir: engineDir(),
      hostlistFile: lists.scanHostlist,
      systemDns: await allDnsServers(),
      full,
      signal,
      onProgress: (scan) => this.set({ scan }),
    });

    const now = Date.now();
    const profile: NetworkProfile = {
      networkId: net.id,
      name: net.name,
      isp,
      strategyId: outcome.strategyId,
      dnsNeeded: outcome.dnsPoisoned,
      scannedAt: now,
      lastUsedAt: now,
      results: outcome.results,
    };
    saveProfile(profile);
    this.set({ profile, scan: null });
    if (outcome.partial) this.setWarning("partial", true);
    log.info("scan", `selected: ${outcome.strategyId}${outcome.partial ? " (partial)" : ""}`);
    return profile;
  }

  private async start(strategyArgs: string[] | null, dnsWanted: boolean, lists: Lists, s: Settings): Promise<void> {
    this.set({ phase: this.status.phase === "healing" ? "healing" : "starting", scan: null });

    if (dnsWanted) await this.startDns(lists.domains, s.allTraffic);
    else await this.stopDns();

    if (strategyArgs) {
      const dir = engineDir();
      const engine = new WinwsProcess(dir, (line) => log.info("engine", line));
      const voice = s.voice && s.services.includes("discord");
      const args = buildWinwsArgs({
        strategy: strategyArgs,
        engineDir: dir,
        hostlist: s.allTraffic ? null : lists.hostlist,
        exclude: s.allTraffic && s.excludeDomains.length ? lists.exclude : null,
        voice,
      });
      log.info("engine", `winws ${args.join(" ")}`);
      await engine.start(args);
      this.engine = engine;
      engine.onExit((unexpected) => {
        if (unexpected && this.engine === engine) this.onEngineDied(engine);
      });
    }
    await flushDnsCache();
  }

  private async startDns(domains: readonly string[], all: boolean): Promise<void> {
    this.dohMatcher = (name) => all || domains.some((d) => hostMatches(name, d));
    if (this.dns.running) return;
    try {
      const upstream = await originalDnsServers();
      // Listener first, then point Windows at it, so there is no gap.
      await this.dns.start({
        useDoh: (name) => this.dohMatcher(name),
        upstream,
        onLog: (level, msg) => (level === "warn" ? log.warn("dns", msg) : log.info("dns", msg)),
      });
      await applyLocalDns();
      this.setWarning("dns-port-busy", false);
      this.set({ dnsActive: true });
      log.info("dns", "DNS protection on");
    } catch (err) {
      await this.dns.stop();
      await restoreDns().catch(() => undefined);
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EADDRINUSE" || code === "EACCES") {
        log.warn("dns", "port 53 is taken by another program, DNS protection skipped");
        this.setWarning("dns-port-busy", true);
      } else {
        log.error("dns", `DNS protection failed: ${(err as Error).message}`);
      }
      this.set({ dnsActive: false });
    }
  }

  private async stopDns(): Promise<void> {
    if (hasPendingBackup()) await restoreDns().catch((err: Error) => log.error("dns", `restore failed: ${err.message}`));
    if (this.dns.running) {
      await this.dns.stop();
      log.info("dns", "DNS protection off");
    }
    if (this.status.dnsActive) this.set({ dnsActive: false });
  }

  private async stopEngine(): Promise<void> {
    const engine = this.engine;
    this.engine = null;
    if (engine) await engine.stop();
  }

  private async stopAll(): Promise<void> {
    this.stopHealth();
    await this.stopEngine();
    await this.stopDns();
    this.set({ activeStrategy: null, connectedSince: null });
  }

  /** At least half of the test hosts must answer through the bypass. */
  private async verify(probeHosts: readonly string[]): Promise<boolean> {
    const truth = await resolveTruth(probeHosts.slice(0, 3));
    if (truth.size === 0) return false;
    const results = await probeAll(truth, 5000);
    const passed = results.filter((r) => r.ok).length;
    return passed * 2 >= results.length;
  }

  private async quickDnsCheck(probeHosts: readonly string[]): Promise<boolean> {
    const truth = await resolveTruth(probeHosts);
    const poisoned = await isDnsPoisoned(truth, await allDnsServers()).catch(() => false);
    if (poisoned) log.info("dns", "a DNS server Windows uses returns fake addresses, DNS protection will be used");
    return poisoned;
  }

  /* --------------------------------------------------------- monitoring */

  private startHealth(): void {
    this.stopHealth();
    if (!getSettings().selfHeal) return;
    this.healthTimer = setInterval(() => void this.healthCheck(), HEALTH_INTERVAL_MS);
  }

  private stopHealth(): void {
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.healthTimer = null;
  }

  private async healthCheck(): Promise<void> {
    if (this.status.phase !== "active" || !this.wantActive) return;
    const s = getSettings();
    const lists = this.writeLists(s);
    // The probes connect to DoH-resolved addresses, so they can't notice a
    // resolver that started lying (router or adapter DNS changed while
    // connected). Check the resolvers themselves when protection is off.
    if (s.dnsMode === "auto" && !this.status.dnsActive && (await this.quickDnsCheck(lists.probeHosts))) {
      if (this.status.phase !== "active" || !this.wantActive) return;
      log.warn("app", "DNS changed while connected, reconnecting with DNS protection");
      void this.connect({ healing: true });
      return;
    }
    if (await this.verify(lists.probeHosts)) return;
    await new Promise((r) => setTimeout(r, HEALTH_RECHECK_MS));
    if (this.status.phase !== "active" || (await this.verify(lists.probeHosts))) return;
    log.warn("app", "health check failed twice, looking for a new method");
    void this.connect({ forceScan: getSettings().strategy.kind === "auto", healing: true });
  }

  private onEngineDied(engine: WinwsProcess): void {
    log.error("engine", `engine exited unexpectedly:\n${engine.lastOutput()}`);
    this.engine = null;
    const now = Date.now();
    this.restarts = this.restarts.filter((t) => now - t < RESTART_WINDOW_MS);
    if (!this.wantActive) return;
    if (this.restarts.length >= MAX_RESTARTS) {
      void this.enqueue(async () => {
        throw new FlowError("engine-failed", "the engine keeps stopping");
      });
      return;
    }
    this.restarts.push(now);
    void this.connect({ healing: true });
  }

  private onNetworkChange(): void {
    void detectNetwork().then((net) => {
      const changed = (net?.id ?? null) !== this.lastNetworkId;
      if (!this.wantActive) {
        if (net) this.showNetwork(net, getProfile(net.id)?.isp ?? null);
        else this.set({ network: null });
        return;
      }
      if (changed || this.status.phase === "waiting-network") {
        log.info("app", net ? `network changed to "${net.name}"` : "network lost");
        void this.connect();
      }
    });
  }

  /* ------------------------------------------------------------ helpers */

  private writeLists(s: Settings): Lists {
    const services = s.services.map(serviceById).filter((x): x is TargetService => !!x);
    const fallback = SERVICES[0] as TargetService;
    const effective = services.length || s.customDomains.length || s.allTraffic ? services : [fallback];
    const domains = [...new Set([...effective.flatMap((x) => x.domains), ...s.customDomains])];
    let probeHosts = effective.flatMap((x) => x.probeHosts);
    if (probeHosts.length === 0) probeHosts = s.customDomains.slice(0, 3);
    if (probeHosts.length === 0) probeHosts = [...fallback.probeHosts];

    const dir = runtimeDir();
    mkdirSync(dir, { recursive: true });
    const hostlist = join(dir, "hostlist.txt");
    const scanHostlist = join(dir, "scan-hostlist.txt");
    const exclude = join(dir, "exclude.txt");
    writeFileSync(hostlist, `${domains.join("\n")}\n`, "utf8");
    writeFileSync(scanHostlist, `${[...new Set([...domains, ...probeHosts])].join("\n")}\n`, "utf8");
    writeFileSync(exclude, `${s.excludeDomains.join("\n")}\n`, "utf8");
    return { hostlist, scanHostlist, exclude, domains, probeHosts };
  }

  private async checkDiscordOpen(): Promise<void> {
    const out = await runPowerShell(
      "if (Get-Process -Name 'Discord','DiscordPTB','DiscordCanary' -ErrorAction SilentlyContinue) { 'yes' }",
    ).catch(() => "");
    this.setWarning("discord-open", out === "yes");
  }

  private showNetwork(net: CurrentNetwork, isp: string | null): void {
    this.set({ network: { id: net.id, name: net.name, isp, online: true }, profile: getProfile(net.id) });
  }

  private abortCheck(signal: AbortSignal): void {
    if (signal.aborted) throw new ScanError("aborted", "cancelled");
  }

  private async fail(err: unknown, signal: AbortSignal): Promise<void> {
    if (signal.aborted || (err instanceof ScanError && err.code === "aborted")) return;
    const wasActive = this.status.phase === "active" || this.status.phase === "healing";
    const code: ErrorCode =
      err instanceof FlowError || err instanceof EngineError || err instanceof ScanError ? (err.code as ErrorCode) : "unknown";
    const detail = err instanceof Error ? err.message : String(err);
    log.error("app", `${code}: ${detail}`);
    this.wantActive = false;
    await this.stopAll().catch(() => undefined);
    const error: AppError = { code, detail };
    this.set({ phase: "error", error, scan: null });
    if (wasActive) this.emit("notice", { title: "notify.failed.title", body: `error.${code}` });
  }

  private setWarning(code: string, on: boolean): void {
    const has = this.status.warnings.includes(code);
    if (on === has) return;
    this.set({ warnings: on ? [...this.status.warnings, code] : this.status.warnings.filter((w) => w !== code) });
  }

  private set(patch: Partial<AppStatus>): void {
    Object.assign(this.status, patch);
    this.emitStatus();
  }

  private emitStatus(): void {
    this.emit("status", { ...this.status });
  }
}
