import { app } from "electron";
import { join } from "node:path";
import { resolveLanguage } from "@shared/i18n";
import { classifySite, DEFAULT_EXCLUDES, normalizeDomain, SERVICES, type ServiceId } from "@shared/targets";
import type { Language, Settings } from "@shared/types";
import { readJson, writeJson } from "../json-store";
import { dataDir } from "../paths";

export const DEFAULT_SETTINGS: Settings = {
  language: "system",
  services: ["discord"],
  customDomains: [],
  allTraffic: false,
  excludeDomains: [...DEFAULT_EXCLUDES],
  voice: true,
  dnsMode: "auto",
  strategy: { kind: "auto" },
  autoConnect: true,
  launchAtStartup: false,
  closeToTray: true,
  notifications: true,
  selfHeal: true,
  ispLookup: true,
  seen: { trayHints: 0, startupPrompt: false },
};

const file = (): string => join(dataDir(), "settings.json");

const serviceIds = new Set<string>(SERVICES.map((s) => s.id));
const cleanDomains = (list: unknown): string[] =>
  Array.isArray(list) ? [...new Set(list.map((d) => normalizeDomain(String(d))).filter((d): d is string => !!d))] : [];

/** Merges stored or incoming values over the defaults and drops anything invalid. */
export function sanitize(input: Partial<Settings>, base: Settings = DEFAULT_SETTINGS): Settings {
  const s: Settings = { ...base, ...input, seen: { ...base.seen, ...input.seen } };
  if (!["system", "en", "tr"].includes(s.language)) s.language = "system";
  const services: unknown[] = Array.isArray(s.services) ? s.services : base.services;
  s.services = services.filter((id): id is ServiceId => serviceIds.has(String(id)));
  // A switch that was removed in an update (e.g. Wattpad) lives on as extra sites.
  const retired = services.flatMap((id) => {
    const match = serviceIds.has(String(id)) ? null : classifySite(String(id));
    return match?.kind === "known" ? match.site.domains : [];
  });
  s.customDomains = cleanDomains([...(Array.isArray(s.customDomains) ? s.customDomains : []), ...retired]);
  s.excludeDomains = cleanDomains(s.excludeDomains);
  if (!["auto", "always", "off"].includes(s.dnsMode)) s.dnsMode = "auto";
  if (typeof s.seen.trayHints !== "number") s.seen.trayHints = 0;
  const st = s.strategy as Settings["strategy"] | undefined;
  if (!st || !["auto", "preset", "custom"].includes(st.kind)) s.strategy = { kind: "auto" };
  return s;
}

let current: Settings | null = null;

export function getSettings(): Settings {
  current ??= sanitize(readJson<Partial<Settings>>(file(), {}));
  return current;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  current = sanitize(patch, getSettings());
  writeJson(file(), current);
  return current;
}

/**
 * The language to show, with "system" resolved against Windows' display
 * language. That is app.getLocale(), not the "preferred languages" list: the
 * list can start with en-US on a Turkish Windows (it's the keyboard/input
 * order), while the display language is what the rest of Windows is shown in.
 */
export function effectiveLanguage(s: Settings = getSettings()): Language {
  return resolveLanguage(s.language, [app.getLocale(), ...app.getPreferredSystemLanguages()]);
}

export function resetSettings(language: Settings["language"]): Settings {
  current = { ...DEFAULT_SETTINGS, language };
  writeJson(file(), current);
  return current;
}
