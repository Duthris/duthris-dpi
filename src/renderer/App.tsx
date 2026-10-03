import { useEffect } from "react";
import { BottomBar } from "@/components/BottomBar";
import { InfoCard } from "@/components/InfoCard";
import { LogsSheet } from "@/components/LogsSheet";
import { Notices } from "@/components/Notices";
import { PowerButton } from "@/components/PowerButton";
import { SettingsView } from "@/components/SettingsView";
import { StatusText } from "@/components/StatusText";
import { TitleBar } from "@/components/TitleBar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStore, useT } from "@/lib/store";

export function App() {
  const t = useT();
  const { view, snapshot, logsOpen, setSnapshot, addLog, setLogs } = useStore();

  useEffect(() => {
    void window.dpi.snapshot().then(setSnapshot);
    void window.dpi.logs().then(setLogs);
    const offSnapshot = window.dpi.onSnapshot(setSnapshot);
    const offLog = window.dpi.onLog(addLog);
    return () => {
      offSnapshot();
      offLog();
    };
  }, [setSnapshot, addLog, setLogs]);

  useEffect(() => {
    if (snapshot) document.documentElement.lang = snapshot.language;
  }, [snapshot]);

  if (!snapshot) {
    return (
      <div className="flex h-full flex-col">
        <TitleBar />
      </div>
    );
  }

  const { status } = snapshot;
  const toggle = () => void (status.wantsActive ? window.dpi.disconnect() : window.dpi.connect());

  return (
    <TooltipProvider>
      <div className="relative flex h-full flex-col bg-[radial-gradient(120%_60%_at_50%_0%,hsl(258_86%_63%/0.10),transparent_60%)]">
        <TitleBar />
        {view === "settings" ? (
          <SettingsView snapshot={snapshot} />
        ) : (
          <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
            <div className="flex flex-col items-center gap-3 pt-3">
              <PowerButton
                phase={status.phase}
                wantsActive={status.wantsActive}
                onToggle={toggle}
                label={status.wantsActive ? t("action.disconnect") : t("action.connect")}
              />
              <StatusText snapshot={snapshot} />
            </div>
            <Notices snapshot={snapshot} />
            <InfoCard snapshot={snapshot} />
          </main>
        )}
        <BottomBar />
        {logsOpen ? <LogsSheet /> : null}
      </div>
    </TooltipProvider>
  );
}
