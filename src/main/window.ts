import { BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { iconsDir } from "./paths";

export const WINDOW_WIDTH = 400;
export const WINDOW_HEIGHT = 640;

function devServerUrl(): string | undefined {
  const arg = process.argv.find((a) => a.startsWith("--dev-server="));
  return arg ? arg.slice("--dev-server=".length) : process.env.DPI_DEV_SERVER;
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    show: false,
    backgroundColor: "#0B0911",
    title: "Duthris DPI",
    icon: join(iconsDir(), "icon.ico"),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: !!devServerUrl(),
    },
  });

  // The renderer never navigates and never opens windows; links go through IPC.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.removeMenu();

  const dev = devServerUrl();
  if (dev) {
    // The dev server can be a moment behind (e.g. right after the admin relaunch);
    // without a retry the window would stay on its blank background.
    win.webContents.on("did-fail-load", (_e, _code, _desc, _url, isMainFrame) => {
      if (isMainFrame) setTimeout(() => !win.isDestroyed() && void win.loadURL(dev), 1000);
    });
    void win.loadURL(dev);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
  return win;
}

export function openExternalSafe(url: string): void {
  if (/^https:\/\/github\.com\//.test(url)) void shell.openExternal(url);
}
