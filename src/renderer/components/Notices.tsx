import { AlertTriangle, Info, Rocket, ShieldAlert, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { targetsLabel } from "@shared/labels";
import type { I18nKey } from "@shared/i18n";
import type { AppSnapshot } from "@shared/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useLang, useStore, useT } from "@/lib/store";

type Tone = "error" | "warning" | "info" | "brand";

const toneClass: Record<Tone, string> = {
  error: "border-destructive/35 bg-destructive/8",
  warning: "border-warning/30 bg-warning/8",
  info: "border-border bg-surface-2",
  brand: "border-brand-500/35 bg-brand-500/10",
};

const toneIcon: Record<Tone, ReactNode> = {
  error: <ShieldAlert className="size-4 text-destructive" />,
  warning: <AlertTriangle className="size-4 text-warning" />,
  info: <Info className="size-4 text-brand-300" />,
  brand: <Rocket className="size-4 text-brand-300" />,
};

function Notice({ tone, children, actions, onDismiss }: { tone: Tone; children: ReactNode; actions?: ReactNode; onDismiss?: () => void }) {
  return (
    <div className={cn("animate-slide-up rounded-lg border p-3", toneClass[tone])}>
      <div className="flex gap-2.5">
        <span className="mt-0.5 shrink-0">{toneIcon[tone]}</span>
        <div className="min-w-0 flex-1 text-xs leading-relaxed text-foreground/90">{children}</div>
        {onDismiss ? (
          <button type="button" aria-label="Dismiss" onClick={onDismiss} className="-mr-1 -mt-1 grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      {actions ? <div className="mt-2.5 flex flex-wrap justify-end gap-2">{actions}</div> : null}
    </div>
  );
}

export function Notices({ snapshot }: { snapshot: AppSnapshot }) {
  const t = useT();
  const lang = useLang();
  const updateSettings = useStore((s) => s.updateSettings);
  const [busy, setBusy] = useState<string | null>(null);
  // "Later" hides the prompt for this run; the next start asks again.
  const [dismissedUpdate, setDismissedUpdate] = useState<string | null>(null);
  const { status, settings } = snapshot;
  const err = status.error;
  const notices: ReactNode[] = [];

  const run = (key: string, fn: () => Promise<unknown>) => async () => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  if (status.phase === "error" && err) {
    let actions: ReactNode = (
      <Button size="xs" variant="secondary" onClick={() => void window.dpi.connect()}>
        {t("action.retry")}
      </Button>
    );
    if (err.code === "not-elevated") {
      actions = (
        <Button size="xs" loading={busy === "admin"} onClick={run("admin", () => window.dpi.relaunchAsAdmin())}>
          {t("action.relaunchAdmin")}
        </Button>
      );
    } else if (err.code === "conflict") {
      actions = (
        <Button size="xs" onClick={() => void window.dpi.resolveConflicts()}>
          {t("action.stopConflicts")}
        </Button>
      );
    } else if (err.code === "no-strategy") {
      actions = (
        <>
          <Button size="xs" variant="ghost" onClick={() => void window.dpi.openExternal("issues")}>
            {t("action.report")}
          </Button>
          <Button size="xs" onClick={() => void window.dpi.rescan(true)}>
            {t("action.fullScan")}
          </Button>
        </>
      );
    }
    notices.push(
      <Notice key="error" tone="error" actions={actions}>
        <p>{t(`error.${err.code}` as I18nKey)}</p>
        {err.code === "conflict" && status.conflicts.length > 0 ? (
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {status.conflicts.map((c) => (
              <li key={`${c.kind}:${c.ref}`} className="rounded bg-surface-3 px-1.5 py-px font-mono text-2xs">
                {c.label}
              </li>
            ))}
          </ul>
        ) : null}
      </Notice>,
    );
  } else if (!status.elevated && status.phase === "idle") {
    notices.push(
      <Notice
        key="elevation"
        tone="warning"
        actions={
          <Button size="xs" loading={busy === "admin"} onClick={run("admin", () => window.dpi.relaunchAsAdmin())}>
            {t("action.relaunchAdmin")}
          </Button>
        }
      >
        {t("error.not-elevated")}
      </Notice>,
    );
  }

  for (const w of status.warnings) {
    if (w === "discord-open" && status.phase === "active") {
      notices.push(
        <Notice
          key={w}
          tone="info"
          onDismiss={() => void window.dpi.dismissWarning(w)}
          actions={
            <Button size="xs" loading={busy === "discord"} onClick={run("discord", () => window.dpi.restartDiscord())}>
              {t("action.restartDiscord")}
            </Button>
          }
        >
          {t("warning.discord-open")}
        </Notice>,
      );
    } else if (w === "partial" && status.phase === "active") {
      notices.push(
        <Notice
          key={w}
          tone="warning"
          onDismiss={() => void window.dpi.dismissWarning(w)}
          actions={
            <Button size="xs" variant="secondary" onClick={() => void window.dpi.rescan(true)}>
              {t("action.fullScan")}
            </Button>
          }
        >
          {t("warning.partial", { targets: targetsLabel(lang, settings) })}
        </Notice>,
      );
    } else if (w === "kaspersky" || w === "dns-port-busy") {
      notices.push(
        <Notice key={w} tone="warning" onDismiss={() => void window.dpi.dismissWarning(w)}>
          {t(`warning.${w}`)}
        </Notice>,
      );
    }
  }

  if (status.phase === "active" && status.packaged && !settings.launchAtStartup && !settings.seen.startupPrompt) {
    const answer = (yes: boolean) => () =>
      void updateSettings({ ...(yes ? { launchAtStartup: true } : {}), seen: { ...settings.seen, startupPrompt: true } });
    notices.push(
      <Notice
        key="startup"
        tone="brand"
        actions={
          <>
            <Button size="xs" variant="ghost" onClick={answer(false)}>
              {t("action.notNow")}
            </Button>
            <Button size="xs" onClick={answer(true)}>
              {t("action.yes")}
            </Button>
          </>
        }
      >
        {t("prompt.startup")}
      </Notice>,
    );
  }

  const update = snapshot.update;
  if ((update.status === "ready" || update.status === "available" || update.status === "downloading") && dismissedUpdate !== update.version) {
    const later = (
      <Button size="xs" variant="ghost" onClick={() => setDismissedUpdate(update.version)}>
        {t("action.later")}
      </Button>
    );
    notices.push(
      <Notice
        key="update"
        tone="brand"
        actions={
          update.status === "ready" ? (
            <>
              {later}
              <Button size="xs" loading={busy === "update"} onClick={run("update", () => window.dpi.installUpdate())}>
                {t("action.restartUpdate")}
              </Button>
            </>
          ) : update.status === "available" ? (
            <>
              {later}
              <Button size="xs" onClick={() => void window.dpi.openExternal("releases")}>
                {t("action.download")}
              </Button>
            </>
          ) : undefined
        }
      >
        {update.status === "ready"
          ? t("update.ready", { version: update.version })
          : update.status === "available"
            ? t("update.manual", { version: update.version })
            : t("update.downloading", { version: update.version, percent: update.percent })}
      </Notice>,
    );
  }

  if (notices.length === 0) return null;
  return <div className="flex flex-col gap-2">{notices}</div>;
}
