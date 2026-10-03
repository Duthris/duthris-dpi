// Local DNS forwarder on 127.0.0.1:53 / [::1]:53.
//
// Names of the selected services are resolved over DNS-over-HTTPS, so the ISP
// can't hand back a fake address. Everything else goes to the DNS servers the
// adapter had before, so the rest of the system behaves exactly as it did.

import { createSocket, type RemoteInfo, type Socket } from "node:dgram";
import { createServer, type Server, type Socket as TcpSocket } from "node:net";
import { queryWire } from "./doh";
import { getId, hasEdns, readQuestion, servfail, truncatedAnswer, withId } from "./dns-message";

export interface DnsProxyOptions {
  /** True when this name must be resolved over DoH. */
  useDoh: (name: string) => boolean;
  /** Plain DNS servers for everything else (the adapter's original ones). */
  upstream: readonly string[];
  onLog?: (level: "info" | "warn", msg: string) => void;
}

const UDP_LIMIT = 512;

/** Public resolvers that also listen on a non-standard port. */
const ALT_PORT_RESOLVERS: readonly [string, number][] = [
  ["77.88.8.8", 1253],
  ["94.140.14.140", 5353],
  ["208.67.222.222", 5353],
];

export class DnsProxy {
  private udp: Socket[] = [];
  private tcp: Server[] = [];
  private opts: DnsProxyOptions | null = null;

  get running(): boolean {
    return this.udp.length > 0;
  }

  /** Binds every listener or none. Throws when port 53 is taken. */
  async start(opts: DnsProxyOptions): Promise<void> {
    await this.stop();
    this.opts = opts;
    try {
      for (const [type, host] of [["udp4", "127.0.0.1"], ["udp6", "::1"]] as const) {
        const sock = createSocket({ type, reuseAddr: false });
        sock.on("message", (msg, rinfo) => void this.handleUdp(sock, msg, rinfo));
        sock.on("error", (err) => opts.onLog?.("warn", `udp ${host}: ${err.message}`));
        await new Promise<void>((resolve, reject) => {
          sock.once("error", reject);
          sock.bind(53, host, () => {
            sock.off("error", reject);
            resolve();
          });
        });
        this.udp.push(sock);
      }
      for (const host of ["127.0.0.1", "::1"]) {
        const server = createServer((conn) => this.handleTcp(conn));
        await new Promise<void>((resolve, reject) => {
          server.once("error", reject);
          server.listen(53, host, () => {
            server.off("error", reject);
            resolve();
          });
        });
        this.tcp.push(server);
      }
    } catch (err) {
      await this.stop();
      throw err;
    }
  }

  async stop(): Promise<void> {
    for (const s of this.udp) s.close();
    await Promise.all(this.tcp.map((s) => new Promise<void>((r) => s.close(() => r()))));
    this.udp = [];
    this.tcp = [];
  }

  private async resolve(query: Buffer): Promise<Buffer> {
    const q = readQuestion(query);
    const opts = this.opts;
    if (!opts) return servfail(query, q);
    const id = getId(query);

    if (q && opts.useDoh(q.name)) {
      try {
        // RFC 8484 recommends id 0 for cache friendliness; restore ours after.
        return withId(await queryWire(withId(query, 0)), id);
      } catch (err) {
        opts.onLog?.("warn", `DoH failed for ${q.name}: ${(err as Error).message}`);
      }
      // Networks that block DoH usually still let these through: ISPs only
      // intercept port 53.
      for (const [server, port] of ALT_PORT_RESOLVERS) {
        const answer = await forwardUdp(query, server, port).catch(() => null);
        if (answer) return answer;
      }
      // Never fall back to the ISP for a protected name: its answer is the
      // poisoned one. SERVFAIL makes Windows simply retry.
      return servfail(query, q);
    }

    for (const server of opts.upstream) {
      const answer = await forwardUdp(query, server).catch(() => null);
      if (answer) return answer;
    }
    try {
      return withId(await queryWire(withId(query, 0)), id);
    } catch {
      return servfail(query, q);
    }
  }

  private async handleUdp(sock: Socket, msg: Buffer, rinfo: RemoteInfo): Promise<void> {
    let answer = await this.resolve(msg);
    if (answer.length > UDP_LIMIT && !hasEdns(msg)) answer = truncatedAnswer(msg, readQuestion(msg));
    sock.send(answer, rinfo.port, rinfo.address);
  }

  private handleTcp(conn: TcpSocket): void {
    let buf = Buffer.alloc(0);
    conn.setTimeout(10_000, () => conn.destroy());
    conn.on("error", () => conn.destroy());
    conn.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 2) {
        const len = buf.readUInt16BE(0);
        if (buf.length < 2 + len) break;
        const query = buf.subarray(2, 2 + len);
        buf = buf.subarray(2 + len);
        void this.resolve(Buffer.from(query)).then((answer) => {
          const head = Buffer.alloc(2);
          head.writeUInt16BE(answer.length, 0);
          if (!conn.destroyed) conn.write(Buffer.concat([head, answer]));
        });
      }
    });
  }
}

/** One plain UDP DNS exchange with `server`. */
function forwardUdp(query: Buffer, server: string, port = 53, timeoutMs = 2500): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const sock = createSocket(server.includes(":") ? "udp6" : "udp4");
    const id = getId(query);
    const timer = setTimeout(() => {
      sock.close();
      reject(new Error("timeout"));
    }, timeoutMs);
    sock.on("message", (msg) => {
      if (msg.length < 2 || getId(msg) !== id) return;
      clearTimeout(timer);
      sock.close();
      resolve(msg);
    });
    sock.on("error", (err) => {
      clearTimeout(timer);
      sock.close();
      reject(err);
    });
    sock.send(query, port, server);
  });
}
