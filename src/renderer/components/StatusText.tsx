import { useEffect, useState } from "react";
import { targetsLabel } from "@shared/labels";
import type { AppSnapshot, Language } from "@shared/types";
import { cn } from "@/lib/cn";
import { useLang, useT } from "@/lib/store";

function duration(lang: Language, ms: number): string {
  const min = Math.max(1, Math.floor(ms / 60_000));
  if (min < 60) return lang === "tr" ? `${min} dk` : `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return lang === "tr" ? `${h} sa ${m} dk` : `${h} h ${m} min`;
}

export function StatusText({ snapshot }: { snapshot: AppSnapshot }) {
  const t = useT();
  const lang = useLang();
  const { status, settings } = snapshot;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status.phase !== "active") return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [status.phase]);

  let sub = "";
  switch (status.phase) {
    case "idle":
      sub = t("phase.idle.sub");
      break;
    case "scanning":
    case "healing": {
      const scan = status.scan;
      if (scan?.stage === "dns") sub = t("scan.dns");
      else if (scan?.stage === "baseline") sub = t("scan.baseline");
      else if (scan) sub = t("scan.step", { name: scan.strategyName, i: scan.index, n: scan.total });
      break;
    }
    case "active": {
      const targets = targetsLabel(lang, settings);
      sub = settings.allTraffic ? t("active.all") : t("active.sub", { targets });
      if (status.connectedSince) sub += ` · ${t("active.since", { time: duration(lang, now - status.connectedSince) })}`;
      break;
    }
    case "preparing":
    case "starting":
      sub = status.network?.name ?? "";
      break;
    default:
      sub = "";
  }

  return (
    <div className="flex min-h-[52px] flex-col items-center gap-1 text-center" aria-live="polite">
      <h1
        className={cn(
          "text-xl font-semibold tracking-tight",
          status.phase === "active" && "text-gradient",
          status.phase === "error" && "text-destructive",
        )}
      >
        {t(`phase.${status.phase}`)}
      </h1>
      <p className="line-clamp-2 min-h-5 max-w-[340px] text-balance text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}
