import { ArrowLeft, Check, ChevronDown, Copy, ExternalLink, FolderOpen, Info, Loader2, Plus, RotateCw, ScanSearch, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { ExternalLink as LinkKey } from "@shared/ipc";
import { STRATEGIES, strategyById } from "@shared/strategies";
import { classifySite, SERVICES, splitSiteInput, type ServiceId, type TargetService } from "@shared/targets";
import type { AppSnapshot, DnsMode, LanguagePref, Settings, UpdateState } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { useRelativeTime, useStore, useT } from "@/lib/store";

const BUSY = new Set(["preparing", "scanning", "starting", "healing", "stopping"]);

const fieldClass =
  "w-full rounded-md border border-input bg-background/60 px-2.5 py-2 font-mono text-xs text-foreground transition-colors placeholder:text-subtle-foreground focus:border-ring focus:outline-none";

function Section({ id, title, desc, highlight, children }: { id?: string; title: string; desc?: string; highlight?: boolean; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-2 flex-col gap-2">
      <div className="px-1">
        <h2 className={cn("text-2xs font-semibold uppercase tracking-wider transition-colors duration-500", highlight ? "text-brand-300" : "text-subtle-foreground")}>
          {title}
        </h2>
        {desc ? <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p> : null}
      </div>
      <Card
        className={cn(
          "divide-y divide-border/70 overflow-hidden transition-[border-color,box-shadow] duration-500",
          highlight && "border-brand-500/60 shadow-glow-sm",
        )}
      >
        {children}
      </Card>
    </section>
  );
}

function Row({ label, desc, control, htmlFor, children }: { label: ReactNode; desc?: ReactNode; control?: ReactNode; htmlFor?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <label htmlFor={htmlFor} className="text-sm font-medium">
            {label}
          </label>
          {desc ? <span className="text-xs text-muted-foreground">{desc}</span> : null}
        </div>
        {control}
      </div>
      {children}
    </div>
  );
}

function SwitchRow({ label, desc, checked, disabled, onChange }: { label: ReactNode; desc?: ReactNode; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  const id = useId();
  return <Row label={label} desc={desc} htmlFor={id} control={<Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />} />;
}

function ToolRow({ label, desc, icon, disabled, loading, onClick }: { label: ReactNode; desc?: ReactNode; icon: ReactNode; disabled?: boolean; loading?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{label}</span>
        {desc ? <span className="text-xs text-muted-foreground">{desc}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-4">{loading ? <Loader2 className="animate-spin" /> : icon}</span>
    </button>
  );
}

/**
 * A textarea that keeps its own draft; "Save" appears only once the text
 * differs from what is stored.
 */
function TextEditor({ value, onSave, canSave = () => true, placeholder }: { value: string; onSave: (text: string) => void; canSave?: (text: string) => boolean; placeholder?: string }) {
  const t = useT();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;
  const dirty = draft !== null && draft !== value;
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        spellCheck={false}
        placeholder={placeholder}
        className={cn(fieldClass, "resize-none")}
      />
      {dirty ? (
        <div className="flex justify-end gap-2">
          <Button size="xs" variant="ghost" onClick={() => setDraft(null)}>
            {t("action.cancel")}
          </Button>
          <Button
            size="xs"
            disabled={!canSave(text)}
            onClick={() => {
              onSave(text);
              setDraft(null);
            }}
          >
            {t("action.save")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

interface Note {
  ok: boolean;
  text: string;
}

/**
 * Takes site names ("wattpad") as well as addresses ("wattpad.com"). Names are
 * expanded from the built-in lists, or looked up as name.com, name.net... by
 * the main process. A name that has its own switch turns that switch on
 * instead, when `onService` is given.
 */
function SitesEditor({
  value,
  onChange,
  onService,
  lockLast,
}: {
  value: readonly string[];
  onChange: (domains: string[]) => void;
  /** Returns false when the service was already on. */
  onService?: (service: TargetService) => boolean;
  /** The last entry can't be removed (it is the only target left). */
  lockLast?: boolean;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);

  const add = async () => {
    const entries = splitSiteInput(text).map(classifySite);
    if (entries.length === 0) return;
    setBusy(true);
    try {
      const names = entries.flatMap((e) => (e.kind === "keyword" ? [e.keyword] : []));
      const guessed = names.length ? await window.dpi.lookupSites(names) : {};
      const added: string[] = [];
      const next: Note[] = [];
      const failed: string[] = [];
      const addAll = (input: string, domains: readonly string[]) => {
        added.push(...domains);
        next.push({ ok: true, text: t("settings.sites.added", { input, domains: domains.join(", ") }) });
      };
      for (const e of entries) {
        if (e.kind === "domain") {
          added.push(e.domain);
        } else if (e.kind === "service") {
          if (onService) {
            const key = onService(e.service) ? "settings.sites.enabled" : "settings.sites.alreadyOn";
            next.push({ ok: true, text: t(key, { name: e.service.name }) });
          } else {
            addAll(e.input, e.service.domains);
          }
        } else if (e.kind === "known") {
          addAll(e.input, e.site.domains);
        } else if (e.kind === "keyword") {
          const domains = guessed[e.keyword] ?? [];
          if (domains.length) addAll(e.input, domains);
          else {
            failed.push(e.input);
            next.push({ ok: false, text: t("settings.sites.notFound", { input: e.keyword }) });
          }
        } else {
          failed.push(e.input);
          next.push({ ok: false, text: t("settings.sites.invalid", { input: e.input }) });
        }
      }
      const merged = [...new Set([...value, ...added])];
      if (merged.length !== value.length) onChange(merged);
      setNotes(next);
      // Keep what didn't work so it can be corrected.
      setText(failed.join(" "));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder={t("settings.sites.placeholder")}
          className={cn(fieldClass, "h-8 min-w-0 flex-1 py-0 font-sans")}
        />
        <Button type="submit" size="sm" variant="secondary" loading={busy} disabled={!text.trim()}>
          {busy ? null : <Plus />}
          {t("action.add")}
        </Button>
      </form>
      {notes.length ? (
        <ul className="flex flex-col gap-0.5">
          {notes.map((n) => (
            <li key={n.text} className={cn("flex items-start gap-1.5 text-xs", n.ok ? "text-muted-foreground" : "text-warning")}>
              {n.ok ? <Check className="mt-0.5 size-3 shrink-0 text-success" /> : <Info className="mt-0.5 size-3 shrink-0" />}
              <span className="min-w-0 break-words">{n.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((d) => (
            <span key={d} className="inline-flex items-center gap-0.5 rounded-full bg-accent py-0.5 pl-2 pr-0.5 font-mono text-2xs text-accent-foreground">
              {d}
              <button
                type="button"
                aria-label={t("settings.sites.remove", { domain: d })}
                disabled={lockLast && value.length === 1}
                onClick={() => onChange(value.filter((x) => x !== d))}
                className="grid size-4 place-items-center rounded-full transition-colors hover:bg-brand-500/30 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Runs `fn` after `ms`, cancelling the previous one; cleared on unmount. */
function useTimer(): (fn: () => void, ms: number) => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (fn, ms) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };
}

function UpdateStatus({ update }: { update: UpdateState }) {
  const t = useT();
  switch (update.status) {
    case "current":
      return (
        <span className="flex items-center gap-1.5 text-success">
          {t("settings.update.current")}
          <Check />
        </span>
      );
    case "available":
    case "ready":
    case "downloading":
      return <span className="font-mono text-brand-300">v{update.version}</span>;
    case "error":
      return <span className="text-warning">{t("settings.update.error")}</span>;
    default:
      return <RotateCw />;
  }
}

const ispName = (isp: string | null): string | null => (isp ? isp.replace(/^AS\d+\s+/, "") : null);

export function SettingsView({ snapshot }: { snapshot: AppSnapshot }) {
  const t = useT();
  const ago = useRelativeTime();
  const { setView, updateSettings, section, clearSection } = useStore();
  const { status, settings: s, networks } = snapshot;
  const set = (patch: Partial<Settings>) => void updateSettings(patch);

  const [customPicked, setCustomPicked] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const copiedTimer = useTimer();
  const resetTimer = useTimer();

  // Opened from a specific place on the home screen: bring that section into
  // view and light it up briefly.
  useEffect(() => {
    if (!section) return;
    document.getElementById(`settings-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    const timer = setTimeout(clearSection, 1800);
    return () => clearTimeout(timer);
  }, [section, clearSection]);

  // At least one target must remain.
  const onlyTarget = (id: ServiceId) => s.services.length === 1 && s.services[0] === id && s.customDomains.length === 0 && !s.allTraffic;
  const allTrafficLocked = s.allTraffic && s.services.length === 0 && s.customDomains.length === 0;
  const toggleService = (id: ServiceId, on: boolean) =>
    set({ services: on ? SERVICES.map((x) => x.id).filter((x) => x === id || s.services.includes(x)) : s.services.filter((x) => x !== id) });
  const enableService = (svc: TargetService): boolean => {
    if (s.services.includes(svc.id)) return false;
    toggleService(svc.id, true);
    return true;
  };

  const methodValue = s.strategy.kind === "custom" || customPicked ? "custom" : s.strategy.kind === "preset" ? `preset:${s.strategy.id}` : "auto";
  const pickMethod = (value: string) => {
    if (value === "custom") {
      // Applied once arguments are saved; an empty custom method can't connect.
      setCustomPicked(true);
      return;
    }
    setCustomPicked(false);
    set({ strategy: value.startsWith("preset:") ? { kind: "preset", id: value.slice("preset:".length) } : { kind: "auto" } });
  };
  const customArgs = s.strategy.kind === "custom" ? s.strategy.args : "";

  const restartDiscord = async () => {
    setRestarting(true);
    try {
      await window.dpi.restartDiscord();
    } finally {
      setRestarting(false);
    }
  };

  const copyDiagnostics = async () => {
    await window.dpi.copyDiagnostics();
    setCopied(true);
    copiedTimer(() => setCopied(false), 1500);
  };

  const reset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      resetTimer(() => setConfirmReset(false), 4000);
      return;
    }
    setConfirmReset(false);
    setResetting(true);
    try {
      await window.dpi.resetAll();
    } finally {
      setResetting(false);
    }
  };

  const link = (key: LinkKey, label: string) => (
    <Button key={key} variant="link" size="xs" onClick={() => void window.dpi.openExternal(key)}>
      {label}
      <ExternalLink />
    </Button>
  );

  return (
    <div className="flex min-h-0 flex-1 animate-slide-in flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1 px-3">
        <Button variant="ghost" size="icon" aria-label={t("action.back")} onClick={() => setView("home")}>
          <ArrowLeft />
        </Button>
        <h1 className="text-base font-semibold tracking-tight">{t("settings.title")}</h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-5 pt-2">
        <Section title={t("settings.general")}>
          <Row label={t("settings.language")} desc={t("settings.language.desc")}>
            <Segmented<LanguagePref>
              ariaLabel={t("settings.language")}
              className="self-start"
              value={s.language}
              onChange={(language) => set({ language })}
              options={[
                { value: "system", label: t("settings.language.system") },
                { value: "en", label: "English" },
                { value: "tr", label: "Türkçe" },
              ]}
            />
          </Row>
          <SwitchRow
            label={t("settings.launchAtStartup")}
            desc={status.packaged ? t("settings.launchAtStartup.desc") : t("settings.launchAtStartup.dev")}
            checked={s.launchAtStartup}
            disabled={!status.packaged}
            onChange={(launchAtStartup) => set({ launchAtStartup })}
          />
          <SwitchRow label={t("settings.autoConnect")} desc={t("settings.autoConnect.desc")} checked={s.autoConnect} onChange={(autoConnect) => set({ autoConnect })} />
          <SwitchRow label={t("settings.closeToTray")} desc={t("settings.closeToTray.desc")} checked={s.closeToTray} onChange={(closeToTray) => set({ closeToTray })} />
          <SwitchRow label={t("settings.notifications")} checked={s.notifications} onChange={(notifications) => set({ notifications })} />
        </Section>

        <Section id="settings-targets" title={t("settings.targets")} desc={t("settings.targets.desc")} highlight={section === "targets"}>
          {SERVICES.map((svc) => {
            const on = s.services.includes(svc.id);
            return <SwitchRow key={svc.id} label={svc.name} checked={on} disabled={on && onlyTarget(svc.id)} onChange={(v) => toggleService(svc.id, v)} />;
          })}
          {s.services.includes("discord") ? (
            <SwitchRow label={t("settings.voice")} desc={t("settings.voice.desc")} checked={s.voice} onChange={(voice) => set({ voice })} />
          ) : null}
          <SwitchRow
            label={t("settings.allTraffic")}
            desc={t("settings.allTraffic.desc")}
            checked={s.allTraffic}
            disabled={allTrafficLocked}
            onChange={(allTraffic) => set({ allTraffic })}
          />
          <Row label={t("settings.customDomains")} desc={t("settings.customDomains.desc")}>
            <SitesEditor
              value={s.customDomains}
              onChange={(customDomains) => set({ customDomains })}
              onService={enableService}
              lockLast={s.services.length === 0 && !s.allTraffic}
            />
          </Row>
          {s.allTraffic ? (
            <Row label={t("settings.excludeDomains")} desc={t("settings.excludeDomains.desc")}>
              <SitesEditor value={s.excludeDomains} onChange={(excludeDomains) => set({ excludeDomains })} />
            </Row>
          ) : null}
        </Section>

        <Section title={t("settings.connection")}>
          <SwitchRow label={t("settings.selfHeal")} desc={t("settings.selfHeal.desc")} checked={s.selfHeal} onChange={(selfHeal) => set({ selfHeal })} />
          <Row label={t("settings.dns")} desc={t("settings.dns.desc")}>
            <Segmented<DnsMode>
              ariaLabel={t("settings.dns")}
              className="self-start"
              value={s.dnsMode}
              onChange={(dnsMode) => set({ dnsMode })}
              options={[
                { value: "auto", label: t("settings.dns.auto") },
                { value: "always", label: t("settings.dns.always") },
                { value: "off", label: t("settings.dns.off") },
              ]}
            />
          </Row>
          <SwitchRow label={t("settings.ispLookup")} desc={t("settings.ispLookup.desc")} checked={s.ispLookup} onChange={(ispLookup) => set({ ispLookup })} />
        </Section>

        <Section title={t("settings.advanced")}>
          <Row label={t("settings.method")} desc={methodValue === "custom" ? t("settings.method.custom.desc") : undefined}>
            <div className="relative">
              <select
                aria-label={t("settings.method")}
                value={methodValue}
                onChange={(e) => pickMethod(e.target.value)}
                className="h-8 w-full appearance-none rounded-md border border-input bg-surface-3 pl-2.5 pr-8 text-xs font-medium text-foreground [color-scheme:dark] transition-colors hover:border-brand-500/45 focus:border-ring focus:outline-none"
              >
                <option value="auto">{t("settings.method.auto")}</option>
                {STRATEGIES.map((st) => (
                  <option key={st.id} value={`preset:${st.id}`}>
                    {st.name}
                  </option>
                ))}
                <option value="custom">{t("settings.method.custom")}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
            {methodValue === "custom" ? (
              <TextEditor
                value={customArgs}
                placeholder="--dpi-desync=fake --dpi-desync-ttl=4"
                canSave={(text) => text.trim().length > 0}
                onSave={(args) => {
                  setCustomPicked(false);
                  set({ strategy: { kind: "custom", args: args.trim() } });
                }}
              />
            ) : null}
          </Row>
          <ToolRow
            label={t("action.fullScan")}
            desc={t("settings.fullScan.desc")}
            icon={<ScanSearch />}
            disabled={!status.elevated || BUSY.has(status.phase)}
            onClick={() => void window.dpi.rescan(true)}
          />
          <Row label={t("settings.networks")} desc={networks.length ? undefined : t("settings.networks.empty")}>
            {networks.length ? (
              <ul className="-mx-1 flex flex-col">
                {networks.map((n) => {
                  const method = n.strategyId === "none" ? t("card.method.none") : (strategyById(n.strategyId)?.name ?? n.strategyId);
                  return (
                    <li key={n.networkId} className="flex items-center gap-2 rounded-md px-1 py-1.5">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm">{n.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{ispName(n.isp) ?? t("card.unknownIsp")}</span>
                        <span className="truncate text-xs text-subtle-foreground">{`${method} · ${ago(n.scannedAt)}`}</span>
                      </div>
                      <Button size="xs" variant="ghost" onClick={() => void window.dpi.forgetNetwork(n.networkId)}>
                        {t("action.forget")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </Row>
        </Section>

        <Section title={t("settings.tools")}>
          <ToolRow label={t("action.restartDiscord")} icon={<RotateCw />} loading={restarting} onClick={() => void restartDiscord()} />
          <ToolRow label={t("settings.openLogs")} icon={<FolderOpen />} onClick={() => void window.dpi.openLogsFolder()} />
          <ToolRow
            label={t("settings.copyDiagnostics")}
            icon={
              copied ? (
                <span className="flex items-center gap-1.5 text-success">
                  {t("action.copied")}
                  <Check />
                </span>
              ) : (
                <Copy />
              )
            }
            onClick={() => void copyDiagnostics()}
          />
          <Row
            label={t("settings.reset")}
            desc={t("settings.reset.desc")}
            control={
              <Button size="xs" variant="destructive" loading={resetting} onClick={() => void reset()}>
                {confirmReset ? t("settings.reset.confirm") : t("action.reset")}
              </Button>
            }
          />
        </Section>

        <Section title={t("settings.about")}>
          <Row label={t("settings.about.version")} control={<span className="font-mono text-xs text-muted-foreground">{status.version}</span>} />
          <ToolRow
            label={t("settings.update.check")}
            desc={snapshot.update.status === "unsupported" ? t("settings.update.dev") : t("settings.update.desc")}
            disabled={snapshot.update.status === "unsupported"}
            loading={snapshot.update.status === "checking"}
            icon={<UpdateStatus update={snapshot.update} />}
            onClick={() => void window.dpi.checkUpdate()}
          />
          <div className="flex flex-col gap-1.5 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{t("settings.about.desc")}</p>
            <div className="flex flex-wrap gap-x-4">
              {link("repo", t("settings.about.source"))}
              {link("zapret", "zapret")}
              {link("windivert", "WinDivert")}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
