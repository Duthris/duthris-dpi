// A small speech bubble above the tray icon, shown when the window is closed to
// the tray, so a first-time user doesn't think the app quit. Windows' own toast
// would land in the corner without pointing at anything; this one points at
// the icon (or at the corner when the icon is hidden behind the ^ overflow).

import { BrowserWindow, screen, type Rectangle } from "electron";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { iconsDir } from "./paths";

const WIDTH = 360;
const HEIGHT = 136;
/** Space around the bubble inside the transparent window, for the shadow and the tail. */
const PAD = 12;
const TAIL = 8;
/** Closes even if the page never reports back. */
const FAILSAFE_MS = 30_000;

let current: BrowserWindow | null = null;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

function iconDataUrl(): string {
  try {
    return `data:image/png;base64,${readFileSync(join(iconsDir(), "icon.png")).toString("base64")}`;
  } catch {
    return "";
  }
}

interface Placement {
  x: number;
  y: number;
  /** Tail position, in px from the window's left edge. */
  tailX: number;
  /** The taskbar is at the top: the tail points up. */
  top: boolean;
}

function place(anchor: Rectangle | null): Placement {
  const usable = anchor && anchor.width > 0 && anchor.height > 0 ? anchor : null;
  const display = usable ? screen.getDisplayMatching(usable) : screen.getPrimaryDisplay();
  const wa = display.workArea;
  const top = !!usable && usable.y < wa.y + wa.height / 2;
  const y = top ? wa.y + 4 : wa.y + wa.height - HEIGHT - 4;
  if (!usable) return { x: wa.x + wa.width - WIDTH - 4, y, tailX: WIDTH - 48, top };
  const cx = usable.x + usable.width / 2;
  const x = clamp(Math.round(cx - WIDTH + 56), wa.x, wa.x + wa.width - WIDTH);
  return { x, y, tailX: clamp(Math.round(cx - x), PAD + 22, WIDTH - PAD - 22), top };
}

function page(title: string, body: string, p: Placement): string {
  const icon = iconDataUrl();
  return `<!doctype html><html><head><meta charset="utf-8"><style>
:root {
  --bg: hsl(257 28% 8%); --bg2: hsl(257 25% 11%); --border: hsl(258 20% 18%);
  --fg: hsl(258 20% 96%); --muted: hsl(256 14% 64%); --primary: hsl(258 86% 63%);
  --brand: hsl(258 88% 72%); --success: hsl(158 64% 45%);
  --ease: cubic-bezier(0.16, 1, 0.3, 1); --tail-x: ${p.tailX}px;
}
html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; user-select: none; cursor: default;
  font-family: "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.wrap { position: absolute; inset: ${p.top ? PAD + TAIL : PAD}px ${PAD}px ${p.top ? PAD : PAD + TAIL}px ${PAD}px;
  transform-origin: calc(var(--tail-x) - ${PAD}px) ${p.top ? "0%" : "100%"};
  animation: pop 560ms var(--ease) both; }
.wrap.leaving { animation: leave 260ms ease-in both; }
.bubble { position: relative; box-sizing: border-box; height: 100%; display: flex; align-items: center; gap: 12px;
  padding: 12px 34px 12px 14px; border-radius: 14px; overflow: hidden;
  background: radial-gradient(120% 140% at 0% 0%, hsl(258 86% 63% / 0.16), transparent 55%), linear-gradient(var(--bg2), var(--bg));
  border: 1px solid var(--border);
  box-shadow: 0 12px 28px -10px rgb(0 0 0 / 0.75), 0 0 32px -12px hsl(258 86% 63% / 0.55), inset 0 1px 0 hsl(258 90% 90% / 0.06); }
.tail { position: absolute; left: calc(var(--tail-x) - ${PAD}px - 7px); width: 14px; height: 14px; transform: rotate(45deg);
  background: var(--bg); border: 1px solid var(--border);
  ${p.top ? "top: -7px; border-right: 0; border-bottom: 0; background: var(--bg2);" : "bottom: -7px; border-left: 0; border-top: 0;"} }
.icon { position: relative; flex: none; width: 42px; height: 42px; animation: wave 900ms 380ms var(--ease) both; }
.icon img { width: 42px; height: 42px; display: block; filter: drop-shadow(0 4px 10px hsl(258 86% 63% / 0.45)); }
.dot { position: absolute; right: -2px; bottom: -2px; width: 11px; height: 11px; border-radius: 50%;
  background: var(--success); border: 2px solid var(--bg); }
.dot::after { content: ""; position: absolute; inset: -2px; border-radius: 50%; border: 2px solid var(--success);
  animation: ring 1.8s 600ms ease-out infinite; }
.text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.title { color: var(--fg); font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em;
  animation: rise 500ms 120ms var(--ease) both; }
.body { color: var(--muted); font-size: 12px; line-height: 1.4; animation: rise 500ms 190ms var(--ease) both; }
.close { position: absolute; top: 7px; right: 7px; width: 22px; height: 22px; border: 0; border-radius: 6px; padding: 0;
  background: transparent; color: var(--muted); font-size: 15px; line-height: 22px; }
.close:hover { background: hsl(257 22% 15%); color: var(--fg); }
.bar { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; transform-origin: left;
  background: linear-gradient(90deg, var(--brand), var(--primary), hsl(243 75% 62%));
  animation: drain 6500ms 500ms linear both; }
.wrap:hover .bar { animation-play-state: paused; }
@keyframes pop { from { opacity: 0; transform: translateY(${p.top ? -14 : 14}px) scale(0.86); } to { opacity: 1; transform: none; } }
@keyframes leave { to { opacity: 0; transform: translateY(${p.top ? -8 : 8}px) scale(0.96); } }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes wave { 0% { transform: scale(0.6) rotate(0); opacity: 0; } 40% { transform: scale(1.08) rotate(-10deg); opacity: 1; }
  60% { transform: rotate(8deg); } 80% { transform: rotate(-4deg); } 100% { transform: none; } }
@keyframes ring { from { transform: scale(1); opacity: 0.8; } to { transform: scale(2.4); opacity: 0; } }
@keyframes drain { from { transform: scaleX(1); } to { transform: scaleX(0); } }
@media (prefers-reduced-motion: reduce) {
  .wrap, .wrap.leaving, .icon, .title, .body, .dot::after { animation-duration: 1ms !important; animation-delay: 0ms !important; }
}
</style></head><body>
<div class="wrap" id="wrap">
  <div class="bubble" id="bubble">
    <div class="icon">${icon ? `<img src="${icon}" alt="">` : ""}<span class="dot"></span></div>
    <div class="text"><div class="title">${escapeHtml(title)}</div><div class="body">${escapeHtml(body)}</div></div>
    <button class="close" id="close" aria-label="Close">&#x2715;</button>
    <div class="bar" id="bar"></div>
  </div>
  <div class="tail"></div>
</div>
<script>
  const wrap = document.getElementById("wrap");
  let done = false;
  const leave = (action) => {
    if (done) return;
    done = true;
    wrap.classList.add("leaving");
    wrap.addEventListener("animationend", () => { location.href = "duthris-hint:" + action; }, { once: true });
  };
  document.getElementById("bar").addEventListener("animationend", () => leave("done"));
  document.getElementById("close").addEventListener("click", (e) => { e.stopPropagation(); leave("done"); });
  document.getElementById("bubble").addEventListener("click", () => leave("open"));
</script>
</body></html>`;
}

export function closeTrayHint(): void {
  if (current && !current.isDestroyed()) current.destroy();
  current = null;
}

/**
 * Shows the bubble without taking focus. `anchor` is the tray icon's bounds;
 * clicking the bubble calls `onOpen`.
 */
export function showTrayHint(opts: { title: string; body: string; anchor: Rectangle | null; onOpen: () => void }): void {
  closeTrayHint();
  const p = place(opts.anchor);
  const win = new BrowserWindow({
    x: p.x,
    y: p.y,
    width: WIDTH,
    height: HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, devTools: false, spellcheck: false },
  });
  current = win;
  win.setAlwaysOnTop(true, "pop-up-menu");

  // The page reports through navigations to a scheme nothing else uses.
  win.webContents.on("will-navigate", (e, url) => {
    e.preventDefault();
    if (url === "duthris-hint:open") opts.onOpen();
    if (win === current) closeTrayHint();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.once("ready-to-show", () => win.showInactive());
  const failsafe = setTimeout(() => win === current && closeTrayHint(), FAILSAFE_MS);
  win.on("closed", () => clearTimeout(failsafe));

  void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page(opts.title, opts.body, p))}`);
}
