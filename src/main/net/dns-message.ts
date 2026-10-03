// Just enough of the DNS wire format (RFC 1035) to route queries: read the
// question name, patch ids and synthesize error / truncated answers.

const HEADER = 12;

export interface Question {
  name: string;
  type: number;
  /** Offset right after the question section. */
  end: number;
}

export function readQuestion(msg: Buffer): Question | null {
  if (msg.length < HEADER + 5) return null;
  if (msg.readUInt16BE(4) < 1) return null;
  const labels: string[] = [];
  let off = HEADER;
  for (let guard = 0; guard < 128; guard++) {
    const len = msg[off];
    if (len === undefined) return null;
    off += 1;
    if (len === 0) break;
    // Compression pointers never appear in a question we receive.
    if (len > 63 || off + len > msg.length) return null;
    labels.push(msg.toString("latin1", off, off + len));
    off += len;
  }
  if (off + 4 > msg.length) return null;
  return { name: labels.join(".").toLowerCase(), type: msg.readUInt16BE(off), end: off + 4 };
}

export const getId = (msg: Buffer): number => msg.readUInt16BE(0);

export function withId(msg: Buffer, id: number): Buffer {
  const copy = Buffer.from(msg);
  copy.writeUInt16BE(id, 0);
  return copy;
}

/** True when the query carries an EDNS0 OPT record, i.e. accepts >512 byte UDP answers. */
export const hasEdns = (msg: Buffer): boolean => msg.length >= HEADER && msg.readUInt16BE(10) > 0;

/** Answer with only the header + question and the given flags/rcode. */
function bareAnswer(query: Buffer, q: Question | null, rcode: number, truncated: boolean): Buffer {
  const end = q?.end ?? HEADER;
  const out = Buffer.from(query.subarray(0, end));
  const rd = (query[2] ?? 0) & 0x01;
  out[2] = 0x80 | (truncated ? 0x02 : 0) | rd; // QR, TC, RD
  out[3] = 0x80 | (rcode & 0x0f); // RA + RCODE
  out.writeUInt16BE(q ? 1 : 0, 4);
  out.writeUInt16BE(0, 6);
  out.writeUInt16BE(0, 8);
  out.writeUInt16BE(0, 10);
  return out;
}

export const servfail = (query: Buffer, q: Question | null): Buffer => bareAnswer(query, q, 2, false);

/** Tells the client to retry over TCP. */
export const truncatedAnswer = (query: Buffer, q: Question | null): Buffer => bareAnswer(query, q, 0, true);
