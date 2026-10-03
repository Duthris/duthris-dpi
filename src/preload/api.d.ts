import type { ExternalLink } from "../shared/ipc";
import type { AppSnapshot, LogEntry, Settings } from "../shared/types";

export interface DpiApi {
  snapshot(): Promise<AppSnapshot>;
  logs(): Promise<LogEntry[]>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  rescan(full?: boolean): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  resolveConflicts(): Promise<void>;
  dismissWarning(code: string): Promise<void>;
  forgetNetwork(id: string): Promise<void>;
  /** For names the built-in lists don't know: name -> existing name.com, name.net... */
  lookupSites(names: string[]): Promise<Record<string, string[]>>;
  restartDiscord(): Promise<boolean>;
  relaunchAsAdmin(): Promise<boolean>;
  openLogsFolder(): Promise<void>;
  openExternal(key: ExternalLink): Promise<void>;
  clearLogs(): Promise<void>;
  copyDiagnostics(): Promise<void>;
  resetAll(): Promise<void>;
  checkUpdate(): Promise<void>;
  /** Stops protection, restores DNS, then restarts into the installer. */
  installUpdate(): Promise<void>;
  minimize(): Promise<void>;
  close(): Promise<void>;
  onSnapshot(fn: (snap: AppSnapshot) => void): () => void;
  onLog(fn: (entry: LogEntry) => void): () => void;
}

declare global {
  interface Window {
    dpi: DpiApi;
  }
}
