import { Menu, nativeImage, Tray, type NativeImage, type Rectangle } from "electron";
import { join } from "node:path";
import { translate } from "@shared/i18n";
import { targetsLabel } from "@shared/labels";
import type { AppStatus, Language, Phase, Settings } from "@shared/types";
import { iconsDir } from "./paths";

export interface TrayActions {
  open: () => void;
  connect: () => void;
  disconnect: () => void;
  rescan: () => void;
  quit: () => void;
}

type TrayState = "active" | "idle" | "busy" | "error";

const stateOf = (phase: Phase): TrayState => {
  switch (phase) {
    case "active":
      return "active";
    case "error":
      return "error";
    case "idle":
    case "waiting-network":
      return "idle";
    default:
      return "busy";
  }
};

export class AppTray {
  private tray: Tray;
  private images = new Map<TrayState, NativeImage>();
  private lastKey = "";

  constructor(private readonly actions: TrayActions) {
    for (const s of ["active", "idle", "busy", "error"] as const) {
      // nativeImage picks up the @2x file next to it for high-DPI screens.
      this.images.set(s, nativeImage.createFromPath(join(iconsDir(), `tray-${s}.png`)));
    }
    this.tray = new Tray(this.images.get("idle") as NativeImage);
    this.tray.on("click", () => actions.open());
    this.tray.on("double-click", () => actions.open());
  }

  update(status: AppStatus, settings: Settings, lang: Language): void {
    const state = stateOf(status.phase);
    const targets = targetsLabel(lang, settings);
    const key = JSON.stringify([state, status.phase, lang, targets, status.network?.name, status.wantsActive]);
    if (key === this.lastKey) return;
    this.lastKey = key;

    this.tray.setImage(this.images.get(state) as NativeImage);
    const phaseText = translate(lang, `phase.${status.phase}`);
    const where = status.network?.name ? ` · ${status.network.name}` : "";
    this.tray.setToolTip(`Duthris DPI — ${phaseText}${status.phase === "active" ? ` (${targets})` : ""}${where}`);

    const on = status.wantsActive;
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: `${phaseText}${status.phase === "active" ? ` · ${targets}` : ""}`, enabled: false },
        { type: "separator" },
        on
          ? { label: translate(lang, "tray.disconnect"), click: this.actions.disconnect }
          : { label: translate(lang, "tray.connect"), click: this.actions.connect },
        { label: translate(lang, "tray.rescan"), click: this.actions.rescan, enabled: status.elevated },
        { type: "separator" },
        { label: translate(lang, "tray.open"), click: this.actions.open },
        { label: translate(lang, "tray.quit"), click: this.actions.quit },
      ]),
    );
  }

  /** Where the icon is on screen; empty when Windows keeps it in the ^ overflow. */
  bounds(): Rectangle {
    return this.tray.getBounds();
  }

  destroy(): void {
    this.tray.destroy();
  }
}
