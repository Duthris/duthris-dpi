// Channel names shared by main and preload. Kept in one place so a typo can't
// silently break a call.

export const IPC = {
  snapshot: "dpi:snapshot",
  logs: "dpi:logs",
  connect: "dpi:connect",
  disconnect: "dpi:disconnect",
  rescan: "dpi:rescan",
  updateSettings: "dpi:update-settings",
  resolveConflicts: "dpi:resolve-conflicts",
  dismissWarning: "dpi:dismiss-warning",
  forgetNetwork: "dpi:forget-network",
  lookupSites: "dpi:lookup-sites",
  restartDiscord: "dpi:restart-discord",
  relaunchAsAdmin: "dpi:relaunch-admin",
  openLogsFolder: "dpi:open-logs",
  openExternal: "dpi:open-external",
  clearLogs: "dpi:clear-logs",
  copyDiagnostics: "dpi:copy-diagnostics",
  resetAll: "dpi:reset-all",
  checkUpdate: "dpi:check-update",
  installUpdate: "dpi:install-update",
  windowMinimize: "dpi:window-minimize",
  windowClose: "dpi:window-close",

  // main -> renderer
  onSnapshot: "dpi:on-snapshot",
  onLog: "dpi:on-log",
} as const;

/** The only external URLs the renderer may ask main to open. */
export const EXTERNAL_LINKS = {
  repo: "https://github.com/Duthris/duthris-dpi",
  issues: "https://github.com/Duthris/duthris-dpi/issues",
  releases: "https://github.com/Duthris/duthris-dpi/releases/latest",
  zapret: "https://github.com/bol-van/zapret",
  windivert: "https://github.com/basil00/WinDivert",
} as const;

export type ExternalLink = keyof typeof EXTERNAL_LINKS;
