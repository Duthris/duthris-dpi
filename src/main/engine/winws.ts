import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ErrorCode } from "@shared/types";

export const ENGINE_FILES = ["winws.exe", "cygwin1.dll", "WinDivert.dll", "WinDivert64.sys"] as const;

export class EngineError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function engineFilesPresent(dir: string): boolean {
  return ENGINE_FILES.every((f) => existsSync(join(dir, f)));
}

/**
 * Maps winws / WinDivert failures to something we can explain to a user.
 * WinDivert reports Windows error codes; the common ones are below.
 */
function classify(output: string): { code: ErrorCode; hint: string } {
  const text = output.toLowerCase();
  const has = (n: number): boolean => new RegExp(`(error|code|err)[^\\n]{0,40}\\b${n}\\b`).test(text);
  if (has(577) || has(1275) || has(1260)) {
    return { code: "driver-blocked", hint: "the WinDivert driver was blocked (antivirus, Memory Integrity or driver policy)" };
  }
  if (has(5)) return { code: "not-elevated", hint: "access denied, administrator rights are required" };
  if (has(2) || has(3)) return { code: "engine-missing", hint: "WinDivert files are missing (often removed by an antivirus)" };
  if (has(1058)) return { code: "driver-blocked", hint: "the WinDivert service is disabled" };
  return { code: "engine-failed", hint: "the engine stopped unexpectedly" };
}

type LineHandler = (line: string) => void;

/** One winws process. Not reusable: create a new instance per start. */
export class WinwsProcess {
  private child: ChildProcess | null = null;
  private output: string[] = [];
  private exitHandlers = new Set<(unexpected: boolean) => void>();
  private stopping = false;

  constructor(
    private readonly dir: string,
    private readonly onLine: LineHandler,
  ) {}

  get pid(): number | undefined {
    return this.child?.pid;
  }

  get alive(): boolean {
    return !!this.child && this.child.exitCode === null && !this.child.killed;
  }

  /** `unexpected` is false when the exit was caused by stop(). */
  onExit(fn: (unexpected: boolean) => void): () => void {
    this.exitHandlers.add(fn);
    return () => this.exitHandlers.delete(fn);
  }

  /**
   * Starts winws and resolves once it is capturing packets. winws is a cygwin
   * program, so its stdout may be block-buffered on a pipe; if the "capture is
   * started" line doesn't arrive, a process that is still alive after the grace
   * period is treated as ready (filter errors make it exit immediately).
   */
  start(args: readonly string[], graceMs = 1500): Promise<void> {
    if (!engineFilesPresent(this.dir)) {
      return Promise.reject(new EngineError("engine-missing", "engine files are missing"));
    }

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = (err?: EngineError): void => {
        if (settled) return;
        settled = true;
        clearTimeout(grace);
        if (err) reject(err);
        else resolve();
      };

      const child = spawn(join(this.dir, "winws.exe"), args, {
        cwd: this.dir,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.child = child;

      const onData = (chunk: Buffer): void => {
        for (const raw of chunk.toString("utf8").split(/\r?\n/)) {
          const line = raw.trim();
          if (!line) continue;
          this.output.push(line);
          if (this.output.length > 200) this.output.shift();
          this.onLine(line);
          if (/capture is started/i.test(line)) done();
        }
      };
      child.stdout?.on("data", onData);
      child.stderr?.on("data", onData);

      child.once("error", (err: NodeJS.ErrnoException) => {
        // EACCES / 740: the executable demands elevation we don't have.
        const code: ErrorCode = err.code === "EACCES" || err.errno === 740 ? "not-elevated" : "engine-failed";
        done(new EngineError(code, err.message));
      });

      child.once("exit", (code) => {
        const { code: errCode, hint } = classify(this.output.join("\n"));
        done(new EngineError(errCode, `${hint} (exit code ${code ?? "?"})`));
        for (const fn of this.exitHandlers) fn(!this.stopping);
      });

      const grace = setTimeout(() => {
        if (this.alive) done();
      }, graceMs);
    });
  }

  /** Kills the process and waits until it is really gone (WinDivert handle released). */
  stop(): Promise<void> {
    const child = this.child;
    if (!child || child.exitCode !== null) return Promise.resolve();
    this.stopping = true;
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, 3000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill();
    });
  }

  lastOutput(): string {
    return this.output.slice(-20).join("\n");
  }
}
