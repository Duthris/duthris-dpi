import { app, BrowserWindow, clipboard, ipcMain, Notification, shell } from "electron";
import { join } from "node:path";
import { EXTERNAL_LINKS, IPC, type ExternalLink } from "@shared/ipc";
import { translate } from "@shared/i18n";
import { targetsLabel } from "@shared/labels";
import type { AppSnapshot, Settings } from "@shared/types";
import { Controller, type Notice } from "./core/controller";
import { buildDiagnostics } from "./diagnostics";
import { log } from "./logger";
import { guessDomains } from "./net/site-lookup";
import { iconsDir, logsDir } from "./paths";
import { forgetAll, forgetProfile, hasAnyProfile, listNetworks } from "./state/networks";
import { effectiveLanguage, getSettings, resetSettings, updateSettings } from "./state/settings";
import { isAutostartEnabled, setAutostart } from "./system/autostart";
import { restartDiscord } from "./system/discord";
import { HANDOFF_EXIT_CODE, relaunchAsAdmin } from "./system/elevation";
import { AppTray } from "./tray";
import { closeTrayHint, showTrayHint } from "./tray-hint";
import { Updater } from "./updater";
import { createMainWindow, openExternalSafe } from "./window";

const startedByAutostart = process.argv.includes("--autostart");
/** How many times the "still running" bubble is shown before the user is assumed to know. */
const TRAY_HINT_TIMES = 3;

let win: BrowserWindow | null = null;
let tray: AppTray | null = null;
let controller: Controller;
let updater: Updater;
/** Versions already announced with a notification. */
const announced = new Set<string>();
let quitting = false;
let cleanedUp = false;

function snapshot(): AppSnapshot {
  const settings = getSettings();
  return {
    language: effectiveLanguage(settings),
    status: { ...controller.status },
    settings,
    networks: listNetworks(),
    update: updater?.state ?? { status: "idle" },
  };
}

function push(): void {
  const snap = snapshot();
  tray?.update(snap.status, snap.settings, snap.language);
  if (win && !win.isDestroyed()) win.webContents.send(IPC.onSnapshot, snap);
}

function showWindow(): void {
  closeTrayHint();
  if (!win || win.isDestroyed()) {
    win = buildWindow();
    win.once("ready-to-show", () => win?.show());
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function buildWindow(): BrowserWindow {
  const w = createMainWindow();
  w.on("close", (e) => {
    if (quitting || !getSettings().closeToTray) return;
    e.preventDefault();
    w.hide();
    const s = getSettings();
    if (s.seen.trayHints < TRAY_HINT_TIMES) {
      updateSettings({ seen: { ...s.seen, trayHints: s.seen.trayHints + 1 } });
      showTrayHint({
        title: translate(effectiveLanguage(s), "notify.trayHint.title"),
        body: translate(effectiveLanguage(s), "notify.trayHint.body"),
        anchor: tray?.bounds() ?? null,
        onOpen: showWindow,
      });
    }
  });
  w.on("closed", () => {
    if (win === w) win = null;
  });
  return w;
}

function notify(n: Notice, force = false): void {
  const s = getSettings();
  if (!s.notifications && !force) return;
  // When the window is in front of the user, the UI already says it.
  if (!force && win?.isVisible() && win.isFocused()) return;
  if (!Notification.isSupported()) return;
  const lang = effectiveLanguage(s);
  const vars = { targets: targetsLabel(lang, s), ...n.vars };
  const note = new Notification({
    title: translate(lang, n.title, vars),
    body: translate(lang, n.body, vars),
    icon: join(iconsDir(), "icon.png"),
    silent: true,
  });
  note.on("click", showWindow);
  note.show();
}

async function quit(): Promise<void> {
  quitting = true;
  app.quit();
}

function registerIpc(): void {
  ipcMain.handle(IPC.snapshot, () => snapshot());
  ipcMain.handle(IPC.logs, () => log.all());
  ipcMain.handle(IPC.connect, () => void controller.connect());
  ipcMain.handle(IPC.disconnect, () => void controller.disconnect());
  ipcMain.handle(IPC.rescan, (_e, full: unknown) => void controller.rescan(full === true));
  ipcMain.handle(IPC.resolveConflicts, () => void controller.resolveConflicts());
  ipcMain.handle(IPC.dismissWarning, (_e, code: unknown) => {
    if (typeof code === "string") controller.dismissWarning(code);
  });

  ipcMain.handle(IPC.updateSettings, async (_e, patch: unknown) => {
    if (!patch || typeof patch !== "object") return getSettings();
    const prev = getSettings();
    let next = updateSettings(patch as Partial<Settings>);
    if (prev.launchAtStartup !== next.launchAtStartup) {
      try {
        await setAutostart(next.launchAtStartup);
      } catch (err) {
        log.error("app", `autostart: ${(err as Error).message}`);
        next = updateSettings({ launchAtStartup: prev.launchAtStartup });
      }
    }
    controller.onSettingsChanged(prev, next);
    push();
    return next;
  });

  ipcMain.handle(IPC.forgetNetwork, (_e, id: unknown) => {
    if (typeof id === "string") forgetProfile(id);
    push();
  });

  ipcMain.handle(IPC.lookupSites, (_e, names: unknown) =>
    Array.isArray(names) ? guessDomains(names.filter((n): n is string => typeof n === "string")) : {},
  );

  ipcMain.handle(IPC.restartDiscord, async () => {
    const ok = await restartDiscord();
    if (ok) controller.dismissWarning("discord-open");
    log.info("app", ok ? "Discord restarted" : "Discord installation not found");
    return ok;
  });

  ipcMain.handle(IPC.relaunchAsAdmin, async () => {
    // The elevated copy must be able to take the single-instance lock.
    app.releaseSingleInstanceLock();
    if (await relaunchAsAdmin()) {
      quitting = true;
      cleanedUp = true;
      app.exit(HANDOFF_EXIT_CODE);
      return true;
    }
    app.requestSingleInstanceLock();
    return false;
  });

  ipcMain.handle(IPC.openLogsFolder, () => void shell.openPath(logsDir()));
  ipcMain.handle(IPC.openExternal, (_e, key: unknown) => {
    if (typeof key === "string" && key in EXTERNAL_LINKS) openExternalSafe(EXTERNAL_LINKS[key as ExternalLink]);
  });
  ipcMain.handle(IPC.clearLogs, () => log.clear());
  ipcMain.handle(IPC.copyDiagnostics, () => clipboard.writeText(buildDiagnostics(controller.status, getSettings())));

  ipcMain.handle(IPC.resetAll, async () => {
    const lang = getSettings().language;
    await controller.disconnect();
    forgetAll();
    resetSettings(lang);
    await setAutostart(false).catch(() => undefined);
    log.info("app", "everything reset to defaults");
    push();
  });

  ipcMain.handle(IPC.checkUpdate, () => updater.check());
  ipcMain.handle(IPC.installUpdate, () => updater.install());

  ipcMain.handle(IPC.windowMinimize, () => win?.minimize());
  ipcMain.handle(IPC.windowClose, () => win?.close());
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId("com.duthris.dpi");

  app.on("second-instance", () => showWindow());

  // Lives in the tray; closing the window must not end the app.
  app.on("window-all-closed", () => undefined);

  app.on("before-quit", (e) => {
    quitting = true;
    if (cleanedUp) return;
    // Restore DNS and stop the engine before the process goes away.
    e.preventDefault();
    void controller
      ?.shutdown()
      .catch(() => undefined)
      .finally(() => {
        cleanedUp = true;
        closeTrayHint();
        tray?.destroy();
        app.quit();
      });
  });

  void app.whenReady().then(async () => {
    controller = new Controller();
    controller.on("status", () => push());
    controller.on("notice", (n) => notify(n));

    updater = new Updater(async () => {
      // The installer replaces winws.exe and the driver: nothing may hold them.
      quitting = true;
      await controller.shutdown().catch(() => undefined);
      cleanedUp = true;
      closeTrayHint();
      tray?.destroy();
    });
    updater.on("change", (u) => {
      push();
      const ready = u.status === "ready" || (u.status === "available" && u.manual);
      if (ready && !announced.has(u.version)) {
        announced.add(u.version);
        notify({
          title: "notify.update.title",
          body: u.status === "ready" ? "notify.update.body" : "notify.update.manual",
          vars: { version: u.version },
        });
      }
    });
    log.subscribe((entry) => {
      if (win && !win.isDestroyed()) win.webContents.send(IPC.onLog, entry);
    });
    registerIpc();

    tray = new AppTray({
      open: showWindow,
      connect: () => void controller.connect(),
      disconnect: () => void controller.disconnect(),
      rescan: () => void controller.rescan(),
      quit: () => void quit(),
    });

    win = buildWindow();
    win.once("ready-to-show", () => {
      if (!startedByAutostart) win?.show();
    });

    log.info("app", `Duthris DPI ${app.getVersion()} started${startedByAutostart ? " at sign-in" : ""}`);
    await controller.init();
    push();

    // Keep the setting honest if the task was removed outside the app.
    if (app.isPackaged) {
      const enabled = await isAutostartEnabled();
      if (enabled !== getSettings().launchAtStartup) updateSettings({ launchAtStartup: enabled });
    }

    const s = getSettings();
    // Auto-connect only once the app has worked at least once, so the very
    // first start never scans the network before the user asked for it.
    if ((s.autoConnect || startedByAutostart) && hasAnyProfile() && controller.status.elevated) {
      void controller.connect();
    }
    push();
  });
}
