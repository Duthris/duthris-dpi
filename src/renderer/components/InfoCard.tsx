import { ChevronRight, Network, RefreshCw, ShieldCheck, Target, Wand2 } from "lucide-react";
import type { ReactNode } from "react";
import { strategyById } from "@shared/strategies";
import { serviceById } from "@shared/targets";
import type { AppSnapshot } from "@shared/types";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { useRelativeTime, useStore, useT } from "@/lib/store";

const BUSY = new Set(["preparing", "scanning", "starting", "healing", "stopping"]);

function Row({ icon, title, sub, right, onClick }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void }) {
  const body = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-3 text-brand-300 [&_svg]:size-4">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-sm font-medium">{title}</span>
        {sub ? <span className="truncate text-xs text-muted-foreground">{sub}</span> : null}
      </span>
      {right}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2">
      {body}
    </button>
  ) : (
    <div className="flex items-center gap-3 px-3 py-2.5">{body}</div>
  );
}

/** "AS34984 Superonline Iletisim Hizmetleri A.S." -> "Superonline Iletisim Hizmetleri" */
const prettyIsp = (isp: string): string => isp.replace(/^AS\d+\s+/, "").replace(/\s+(A\.?\s?S\.?|Inc\.?|Ltd\.?)$/i, "");

export function InfoCard({ snapshot }: { snapshot: AppSnapshot }) {
  const t = useT();
  const ago = useRelativeTime();
  const setView = useStore((s) => s.setView);
  const { status, settings } = snapshot;
  const profile = status.profile;
  const busy = BUSY.has(status.phase);

  const strategyId = status.activeStrategy ?? (settings.strategy.kind === "auto" ? profile?.strategyId : settings.strategy.kind === "preset" ? settings.strategy.id : "custom");
  let methodTitle: string = t("settings.method.auto");
  if (strategyId === "none") methodTitle = t("card.method.none");
  else if (strategyId === "custom") methodTitle = t("card.method.custom");
  else if (strategyId) methodTitle = strategyById(strategyId)?.name ?? strategyId;

  const methodSub =
    settings.strategy.kind !== "auto"
      ? t("card.method.manual")
      : profile && profile.networkId === status.network?.id
        ? t("card.method.auto", { time: ago(profile.scannedAt) })
        : t("card.method");

  const chips = settings.allTraffic
    ? [t("card.everything")]
    : [
        ...settings.services.map((id) => serviceById(id)?.name ?? id),
        ...(settings.customDomains.length ? [t("card.moreSites", { n: settings.customDomains.length })] : []),
      ];

  return (
    <Card className="divide-y divide-border/70 overflow-hidden">
      <Row
        icon={<Network />}
        title={status.network?.name ?? "—"}
        sub={status.network?.isp ? prettyIsp(status.network.isp) : t("card.unknownIsp")}
        right={
          <Tooltip content={t("action.rescan")}>
            <button
              type="button"
              aria-label={t("action.rescan")}
              disabled={busy || !status.elevated}
              onClick={() => void window.dpi.rescan(false)}
              className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground disabled:opacity-40"
            >
              <RefreshCw className={busy && status.phase === "scanning" ? "size-4 animate-spin" : "size-4"} />
            </button>
          </Tooltip>
        }
      />
      <Row
        icon={<Wand2 />}
        title={methodTitle}
        sub={methodSub}
        right={
          status.dnsActive ? (
            <Tooltip content={t("settings.dns.desc")}>
              <span className="flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-2xs font-medium text-success">
                <ShieldCheck className="size-3" /> DNS
              </span>
            </Tooltip>
          ) : null
        }
      />
      <Row
        icon={<Target />}
        title={
          <span className="flex flex-wrap gap-1">
            {chips.map((c) => (
              <span key={c} className="rounded-full bg-accent px-2 py-px text-xs font-medium text-accent-foreground">
                {c}
              </span>
            ))}
          </span>
        }
        sub={t("card.appliesTo")}
        right={<ChevronRight className="size-4 shrink-0 text-subtle-foreground" />}
        onClick={() => setView("settings", "targets")}
      />
    </Card>
  );
}
