import { Check, Copy, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LogEntry } from "@shared/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useStore, useT } from "@/lib/store";

const levelClass: Record<LogEntry["level"], string> = {
  info: "text-foreground/80",
  warn: "text-warning",
  error: "text-destructive",
};

const sourceClass: Record<LogEntry["source"], string> = {
  app: "text-brand-300",
  engine: "text-indigo",
  dns: "text-success",
  scan: "text-warning/90",
};

const time = (t: number): string => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function LogsSheet() {
  const t = useT();
  const { logs, setLogs, setLogsOpen } = useStore();
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const copy = async () => {
    await window.dpi.copyDiagnostics();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="absolute inset-x-0 bottom-12 top-10 z-20 flex flex-col">
      <button type="button" aria-label="Close" className="h-16 shrink-0 animate-fade-in bg-background/60" onClick={() => setLogsOpen(false)} />
      <section className="flex min-h-0 flex-1 animate-slide-up flex-col rounded-t-xl border-x border-t border-border bg-surface shadow-card">
        <header className="flex items-center justify-between px-4 py-2.5">
          <h2 className="text-sm font-semibold">{t("logs.title")}</h2>
          <div className="flex items-center gap-1">
            <Button size="xs" variant="ghost" onClick={() => void copy()}>
              {copied ? <Check /> : <Copy />}
              {copied ? t("action.copied") : t("action.copy")}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                void window.dpi.clearLogs();
                setLogs([]);
              }}
            >
              <Trash2 />
              {t("action.clear")}
            </Button>
            <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setLogsOpen(false)}>
              <X />
            </Button>
          </div>
        </header>
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
          className="min-h-0 flex-1 select-text overflow-y-auto border-t border-border/70 bg-background/60 px-3 py-2 font-mono text-[11px] leading-[1.55]"
        >
          {logs.length === 0 ? (
            <p className="py-6 text-center font-sans text-xs text-muted-foreground">{t("logs.empty")}</p>
          ) : (
            logs.map((l, i) => (
              <div key={`${l.t}-${i}`} className={cn("whitespace-pre-wrap break-words", levelClass[l.level])}>
                <span className="text-subtle-foreground">{time(l.t)} </span>
                <span className={sourceClass[l.source]}>{l.source.padEnd(6)}</span>
                {l.msg}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
