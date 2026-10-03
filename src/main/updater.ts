// Self-update from the GitHub releases the release workflow publishes.
//
// The installed (NSIS) build downloads new versions in the background and
// installs them on the next restart, or right away when the user asks. The
// portable build has no installation to replace, so it only checks the latest
// release and points the user at the download.
//
// The executables are unsigned, so there is no publisher to verify against;
// electron-updater still checks each download against the sha512 in latest.yml.

import { EventEmitter } from "node:events";
import { app } from "electron";
import { autoUpdater } from "electron-updater";
import type { UpdateState } from "@shared/types";
import { log } from "./logger";

const REPO = "Duthris/duthris-dpi";
/** After startup, so the check never competes with connecting. */
const FIRST_CHECK_MS = 20_000;
/** The app lives in the tray for days; check again now and then. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const isPortable = (): boolean => Boolean(process.env.PORTABLE_EXECUTABLE_DIR);

/** "1.10.0" > "1.9.3"; pre-release suffixes are ignored. */
function newer(a: string, b: string): boolean {
  const pa = a.replace(/^v/, "").split(/[.-]/).slice(0, 3).map(Number);
  const pb = b.replace(/^v/, "").split(/[.-]/).slice(0, 3).map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export class Updater extends EventEmitter<{ change: [UpdateState] }> {
  state: UpdateState = { status: "idle" };
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly beforeInstall: () => Promise<void>) {
    super();
    if (!app.isPackaged) {
      this.state = { status: "unsupported" };
      return;
    }
    if (!isPortable()) this.wireAutoUpdater();
    setTimeout(() => void this.check(), FIRST_CHECK_MS);
    this.timer = setInterval(() => void this.check(), CHECK_INTERVAL_MS);
  }

  async check(): Promise<void> {
    if (this.state.status === "unsupported" || this.state.status === "downloading" || this.state.status === "ready") return;
    this.set({ status: "checking" });
    try {
      if (isPortable()) await this.checkRelease();
      else await autoUpdater.checkForUpdates();
    } catch (err) {
      const message = err instanceof Error ? err.message.split("\n")[0] ?? "" : String(err);
      log.warn("app", `update check failed: ${message}`);
      this.set({ status: "error", message });
    }
  }

  /** Stops protection and restores DNS first: the installer replaces the engine files. */
  async install(): Promise<void> {
    if (this.state.status !== "ready") return;
    log.info("app", `installing update ${this.state.version}`);
    await this.beforeInstall();
    autoUpdater.quitAndInstall(false, true);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private wireAutoUpdater(): void {
    autoUpdater.logger = null;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("update-available", (info) => {
      log.info("app", `update available: ${info.version}`);
      this.set({ status: "downloading", version: info.version, percent: 0 });
    });
    autoUpdater.on("update-not-available", () => this.set({ status: "current" }));
    autoUpdater.on("download-progress", (p) => {
      if (this.state.status === "downloading") this.set({ ...this.state, percent: Math.round(p.percent) });
    });
    autoUpdater.on("update-downloaded", (info) => {
      log.info("app", `update ${info.version} downloaded, installs on restart`);
      this.set({ status: "ready", version: info.version });
    });
    autoUpdater.on("error", (err) => {
      // A failed download falls back to "available" so the user still hears about it.
      if (this.state.status === "downloading") this.set({ status: "available", version: this.state.version, manual: true });
      else this.set({ status: "error", message: err.message.split("\n")[0] ?? "" });
      log.warn("app", `updater: ${err.message.split("\n")[0]}`);
    });
  }

  private async checkRelease(): Promise<void> {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "duthris-dpi" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`GitHub: HTTP ${res.status}`);
    const { tag_name: tag } = (await res.json()) as { tag_name?: string };
    if (tag && newer(tag, app.getVersion())) {
      log.info("app", `update available: ${tag} (portable, manual download)`);
      this.set({ status: "available", version: tag.replace(/^v/, ""), manual: true });
    } else {
      this.set({ status: "current" });
    }
  }

  private set(next: UpdateState): void {
    this.state = next;
    this.emit("change", next);
  }
}
