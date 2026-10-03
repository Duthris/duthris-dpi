import type { ServiceId } from "./targets";

export type Language = "en" | "tr";
/** What the user picked; "system" follows Windows. */
export type LanguagePref = Language | "system";

export type StrategyChoice =
  | { kind: "auto" }
  | { kind: "preset"; id: string }
  | { kind: "custom"; args: string };

export type DnsMode = "auto" | "always" | "off";

export interface Settings {
  language: LanguagePref;
  services: ServiceId[];
  customDomains: string[];
  /** Apply the bypass to every site instead of only the selected services. */
  allTraffic: boolean;
  excludeDomains: string[];
  /** Discord voice/video (UDP). */
  voice: boolean;
  dnsMode: DnsMode;
  strategy: StrategyChoice;
  /** Connect as soon as the app starts (only after the first successful connection). */
  autoConnect: boolean;
  launchAtStartup: boolean;
  closeToTray: boolean;
  notifications: boolean;
  /** Watch the connection and re-scan on its own when it stops working. */
  selfHeal: boolean;
  /** Look up the ISP name to try the strategies known for it first. */
  ispLookup: boolean;
  /** One-time hints the user has already seen. */
  seen: { trayHints: number; startupPrompt: boolean };
}

export interface NetworkInfo {
  /** Stable id derived from the default gateway (MAC when available). */
  id: string;
  /** Wi-Fi SSID or the Windows network profile name. */
  name: string;
  isp: string | null;
  online: boolean;
}

export interface StrategyResult {
  strategyId: string;
  passed: number;
  total: number;
  ms: number;
}

export interface NetworkProfile {
  networkId: string;
  name: string;
  isp: string | null;
  /** "none" means this network needs no DPI bypass at all. */
  strategyId: string;
  dnsNeeded: boolean;
  scannedAt: number;
  lastUsedAt: number;
  results: StrategyResult[];
}

export type Phase =
  | "idle"
  | "preparing"
  | "scanning"
  | "starting"
  | "active"
  | "healing"
  | "waiting-network"
  | "stopping"
  | "error";

export type ErrorCode =
  | "not-elevated"
  | "engine-missing"
  | "engine-failed"
  | "driver-blocked"
  | "conflict"
  | "offline"
  | "dns-unavailable"
  | "no-strategy"
  | "unsupported-arch"
  | "unknown";

export interface AppError {
  code: ErrorCode;
  detail?: string;
}

export interface Conflict {
  kind: "process" | "service";
  name: string;
  /** Process id or service name, used to stop it. */
  ref: string;
  label: string;
}

export interface ScanProgress {
  index: number;
  total: number;
  strategyName: string;
  stage: "dns" | "baseline" | "strategies";
}

export interface AppStatus {
  phase: Phase;
  /** The user wants protection on (also true while scanning or waiting for a network). */
  wantsActive: boolean;
  elevated: boolean;
  packaged: boolean;
  version: string;
  network: NetworkInfo | null;
  profile: NetworkProfile | null;
  /** The strategy actually running right now ("none", a preset id or "custom"). */
  activeStrategy: string | null;
  dnsActive: boolean;
  scan: ScanProgress | null;
  conflicts: Conflict[];
  error: AppError | null;
  connectedSince: number | null;
  warnings: string[];
}

export interface LogEntry {
  t: number;
  level: "info" | "warn" | "error";
  source: "app" | "engine" | "dns" | "scan";
  msg: string;
}

export interface SavedNetwork {
  networkId: string;
  name: string;
  isp: string | null;
  strategyId: string;
  scannedAt: number;
}

export type UpdateState =
  | { status: "idle" }
  /** Development build: nothing to update. */
  | { status: "unsupported" }
  | { status: "checking" }
  | { status: "current" }
  /** `manual`: the portable build can't replace itself; the new version is downloaded from GitHub. */
  | { status: "available"; version: string; manual: boolean }
  | { status: "downloading"; version: string; percent: number }
  /** Downloaded; installs on restart. */
  | { status: "ready"; version: string }
  | { status: "error"; message: string };

export interface AppSnapshot {
  /** The language the UI is shown in: `settings.language` with "system" resolved. */
  language: Language;
  status: AppStatus;
  settings: Settings;
  networks: SavedNetwork[];
  update: UpdateState;
}
