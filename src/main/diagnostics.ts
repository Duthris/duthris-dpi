import { release } from "node:os";
import type { AppStatus, Settings } from "@shared/types";
import { log } from "./logger";

/** Plain-text report users can paste into a GitHub issue. Contains no IP addresses. */
export function buildDiagnostics(status: AppStatus, settings: Settings): string {
  const p = status.profile;
  const lines = [
    `Duthris DPI ${status.version}${status.packaged ? "" : " (dev)"}`,
    `Windows ${release()} ${process.arch}, elevated: ${status.elevated ? "yes" : "no"}`,
    `Phase: ${status.phase}${status.error ? ` (${status.error.code}: ${status.error.detail ?? ""})` : ""}`,
    `Method: ${status.activeStrategy ?? "-"}, DNS protection: ${status.dnsActive ? "on" : "off"}`,
    `ISP: ${status.network?.isp ?? "unknown"}`,
    `Targets: ${settings.allTraffic ? "all" : settings.services.join(",")}${settings.customDomains.length ? ` +${settings.customDomains.length} custom` : ""}, voice: ${settings.voice}`,
    `Settings: dns=${settings.dnsMode}, method=${settings.strategy.kind}, selfHeal=${settings.selfHeal}`,
    `Warnings: ${status.warnings.join(", ") || "-"}`,
  ];
  if (p) {
    lines.push(
      `Scan ${new Date(p.scannedAt).toISOString()}: ${p.results.map((r) => `${r.strategyId} ${r.passed}/${r.total}`).join(", ")}`,
    );
  }
  lines.push("", "--- log ---");
  for (const e of log.all().slice(-120)) {
    lines.push(`${new Date(e.t).toISOString().slice(11, 19)} ${e.level} [${e.source}] ${e.msg}`);
  }
  return lines.join("\n");
}
