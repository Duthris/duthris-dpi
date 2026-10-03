import { ScrollText, Settings2 } from "lucide-react";
import type { LanguagePref } from "@shared/types";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { useStore, useT } from "@/lib/store";

export function BottomBar() {
  const t = useT();
  const { view, setView, logsOpen, setLogsOpen, updateSettings, logs, snapshot } = useStore();
  const lang = snapshot?.settings.language ?? "system";
  const hasErrors = logs.some((l) => l.level === "error");

  const navClass = (active: boolean) =>
    cn(
      "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
      active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
    );

  return (
    <footer className="flex h-12 shrink-0 items-center justify-between border-t border-border/70 bg-surface/60 px-3">
      <nav className="flex items-center gap-1">
        <button type="button" className={navClass(view === "settings")} onClick={() => setView(view === "settings" ? "home" : "settings")}>
          <Settings2 className="size-4" />
          {t("nav.settings")}
        </button>
        <button type="button" className={navClass(logsOpen)} onClick={() => setLogsOpen(!logsOpen)}>
          <span className="relative">
            <ScrollText className="size-4" />
            {hasErrors && !logsOpen ? <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-destructive" /> : null}
          </span>
          {t("nav.logs")}
        </button>
      </nav>
      <Segmented<LanguagePref>
        ariaLabel={t("settings.language")}
        value={lang}
        onChange={(language) => void updateSettings({ language })}
        options={[
          { value: "system", label: t("settings.language.system") },
          { value: "en", label: "EN" },
          { value: "tr", label: "TR" },
        ]}
      />
    </footer>
  );
}
