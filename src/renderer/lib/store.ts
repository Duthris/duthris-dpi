import { create } from "zustand";
import { relativeTime, translate, type I18nKey } from "@shared/i18n";
import type { AppSnapshot, Language, LogEntry, Settings } from "@shared/types";

export type View = "home" | "settings";
/** A settings section to scroll to when the view opens. */
export type SettingsSection = "targets";

interface UiState {
  view: View;
  section: SettingsSection | null;
  snapshot: AppSnapshot | null;
  logs: LogEntry[];
  logsOpen: boolean;
  setView: (view: View, section?: SettingsSection) => void;
  clearSection: () => void;
  setSnapshot: (s: AppSnapshot) => void;
  addLog: (e: LogEntry) => void;
  setLogs: (l: LogEntry[]) => void;
  setLogsOpen: (open: boolean) => void;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

const MAX_LOGS = 600;

export const useStore = create<UiState>((set, get) => ({
  view: "home",
  section: null,
  snapshot: null,
  logs: [],
  logsOpen: false,
  setView: (view, section) => set({ view, section: section ?? null }),
  clearSection: () => set({ section: null }),
  setSnapshot: (snapshot) => set({ snapshot }),
  addLog: (e) => set((s) => ({ logs: [...s.logs.slice(-(MAX_LOGS - 1)), e] })),
  setLogs: (logs) => set({ logs }),
  setLogsOpen: (logsOpen) => set({ logsOpen }),
  updateSettings: async (patch) => {
    // Optimistic: the switch moves immediately, main confirms with a snapshot.
    const snap = get().snapshot;
    if (snap) set({ snapshot: { ...snap, settings: { ...snap.settings, ...patch } } });
    await window.dpi.updateSettings(patch);
  },
}));

export function useLang(): Language {
  return useStore((s) => s.snapshot?.language ?? "en");
}

export function useT(): (key: I18nKey, vars?: Record<string, string | number>) => string {
  const lang = useLang();
  return (key, vars) => translate(lang, key, vars);
}

export function useRelativeTime(): (ts: number) => string {
  const lang = useLang();
  return (ts) => relativeTime(lang, ts);
}
