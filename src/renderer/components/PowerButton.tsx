import { Power } from "lucide-react";
import type { Phase } from "@shared/types";
import { cn } from "@/lib/cn";

const BUSY: readonly Phase[] = ["preparing", "scanning", "starting", "healing", "stopping"];

interface Props {
  phase: Phase;
  wantsActive: boolean;
  onToggle: () => void;
  label: string;
}

/**
 * The one control most people will ever touch. Off: quiet. Working: a ring
 * spins. On: filled with the brand gradient and slowly "breathing".
 */
export function PowerButton({ phase, wantsActive, onToggle, label }: Props) {
  const busy = BUSY.includes(phase) || (wantsActive && phase === "waiting-network");
  const active = phase === "active";
  const error = phase === "error";

  return (
    <div className="relative grid size-[156px] place-items-center">
      {active && (
        <>
          <span className="absolute inset-3 animate-pulse-ring rounded-full bg-brand-500/30" aria-hidden />
          <span className="absolute inset-3 animate-pulse-ring rounded-full bg-brand-500/20 [animation-delay:1.3s]" aria-hidden />
        </>
      )}
      {busy && (
        <span
          className="absolute inset-1.5 animate-spin-slow rounded-full"
          style={{
            background: "conic-gradient(from 0deg, transparent 0deg, hsl(258 86% 63% / 0.9) 110deg, transparent 220deg)",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
          }}
          aria-hidden
        />
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={wantsActive}
        aria-label={label}
        className={cn(
          "relative grid size-[128px] place-items-center rounded-full transition-all duration-300 ease-brand active:scale-[0.97]",
          active
            ? "bg-[radial-gradient(circle_at_30%_25%,hsl(258_90%_78%),hsl(258_80%_58%)_45%,hsl(258_65%_36%))] text-white shadow-glow-lg"
            : error
              ? "border border-destructive/50 bg-surface-2 text-destructive shadow-[0_0_40px_-12px_hsl(0_72%_55%/0.6)]"
              : busy
                ? "border border-brand-500/30 bg-surface-2 text-brand-300"
                : "border border-border bg-surface-2 text-muted-foreground shadow-card hover:border-brand-500/45 hover:text-brand-300 hover:shadow-glow-md",
        )}
      >
        <span
          className={cn(
            "absolute inset-0 rounded-full",
            active ? "shadow-[inset_0_2px_0_hsl(0_0%_100%/0.25)]" : "shadow-inset",
          )}
          aria-hidden
        />
        <Power className="size-11" strokeWidth={2.2} />
      </button>
    </div>
  );
}
