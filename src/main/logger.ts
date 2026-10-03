import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import type { LogEntry } from "@shared/types";
import { logsDir } from "./paths";

const MAX_ENTRIES = 600;
const MAX_FILE_BYTES = 1024 * 1024;

type Listener = (entry: LogEntry) => void;

class Logger {
  private entries: LogEntry[] = [];
  private listeners = new Set<Listener>();
  private writeChain: Promise<void> = Promise.resolve();

  info(source: LogEntry["source"], msg: string): void {
    this.push({ t: Date.now(), level: "info", source, msg });
  }

  warn(source: LogEntry["source"], msg: string): void {
    this.push({ t: Date.now(), level: "warn", source, msg });
  }

  error(source: LogEntry["source"], msg: string): void {
    this.push({ t: Date.now(), level: "error", source, msg });
  }

  all(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private push(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    for (const fn of this.listeners) fn(entry);
    this.persist(entry);
  }

  private persist(entry: LogEntry): void {
    const line = `${new Date(entry.t).toISOString()} ${entry.level.toUpperCase().padEnd(5)} [${entry.source}] ${entry.msg}\n`;
    // Serialized so lines never interleave; failures are ignored on purpose,
    // logging must never take the app down.
    this.writeChain = this.writeChain
      .then(async () => {
        const dir = logsDir();
        const file = join(dir, "app.log");
        await mkdir(dir, { recursive: true });
        const size = await stat(file).then((s) => s.size, () => 0);
        if (size > MAX_FILE_BYTES) await rename(file, join(dir, "app.old.log")).catch(() => undefined);
        await appendFile(file, line, "utf8");
      })
      .catch(() => undefined);
  }
}

export const log = new Logger();
