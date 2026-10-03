// Bundled into a single file by esbuild: a sandboxed preload can only require
// "electron", so it must not reach for any other module at runtime.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { IPC } from "@shared/ipc";
import type { DpiApi } from "./api";

const subscribe = <T>(channel: string, fn: (value: T) => void): (() => void) => {
  const listener = (_e: IpcRendererEvent, value: T): void => fn(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.off(channel, listener);
};

const api: DpiApi = {
  snapshot: () => ipcRenderer.invoke(IPC.snapshot),
  logs: () => ipcRenderer.invoke(IPC.logs),
  connect: () => ipcRenderer.invoke(IPC.connect),
  disconnect: () => ipcRenderer.invoke(IPC.disconnect),
  rescan: (full) => ipcRenderer.invoke(IPC.rescan, full),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.updateSettings, patch),
  resolveConflicts: () => ipcRenderer.invoke(IPC.resolveConflicts),
  dismissWarning: (code) => ipcRenderer.invoke(IPC.dismissWarning, code),
  forgetNetwork: (id) => ipcRenderer.invoke(IPC.forgetNetwork, id),
  lookupSites: (names) => ipcRenderer.invoke(IPC.lookupSites, names),
  restartDiscord: () => ipcRenderer.invoke(IPC.restartDiscord),
  relaunchAsAdmin: () => ipcRenderer.invoke(IPC.relaunchAsAdmin),
  openLogsFolder: () => ipcRenderer.invoke(IPC.openLogsFolder),
  openExternal: (key) => ipcRenderer.invoke(IPC.openExternal, key),
  clearLogs: () => ipcRenderer.invoke(IPC.clearLogs),
  copyDiagnostics: () => ipcRenderer.invoke(IPC.copyDiagnostics),
  resetAll: () => ipcRenderer.invoke(IPC.resetAll),
  checkUpdate: () => ipcRenderer.invoke(IPC.checkUpdate),
  installUpdate: () => ipcRenderer.invoke(IPC.installUpdate),
  minimize: () => ipcRenderer.invoke(IPC.windowMinimize),
  close: () => ipcRenderer.invoke(IPC.windowClose),
  onSnapshot: (fn) => subscribe(IPC.onSnapshot, fn),
  onLog: (fn) => subscribe(IPC.onLog, fn),
};

contextBridge.exposeInMainWorld("dpi", api);
