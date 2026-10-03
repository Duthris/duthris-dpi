import { Minus, X } from "lucide-react";

export function TitleBar() {
  return (
    <header className="drag flex h-10 shrink-0 items-center justify-between pl-4 pr-1">
      <div className="flex items-center gap-2">
        <img src="./icon.svg" alt="" className="size-[18px]" draggable={false} />
        <span className="text-sm font-semibold tracking-tight">Duthris DPI</span>
      </div>
      <div className="no-drag flex items-center">
        <button
          type="button"
          aria-label="Minimize"
          onClick={() => void window.dpi.minimize()}
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={() => void window.dpi.close()}
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/85 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>
    </header>
  );
}
