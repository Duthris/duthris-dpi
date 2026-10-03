import { app } from "electron";
import { join } from "node:path";

/** Engine binaries: resources/engine in dev, <install>/resources/engine when packaged. */
export function engineDir(): string {
  return app.isPackaged ? join(process.resourcesPath, "engine") : join(app.getAppPath(), "resources", "engine");
}

export function iconsDir(): string {
  return app.isPackaged ? join(process.resourcesPath, "icons") : join(app.getAppPath(), "resources", "icons");
}

export const dataDir = (): string => app.getPath("userData");
export const runtimeDir = (): string => join(dataDir(), "runtime");
export const logsDir = (): string => join(dataDir(), "logs");
