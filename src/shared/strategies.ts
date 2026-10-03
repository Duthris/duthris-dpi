// Catalog of DPI bypass strategies for the zapret `winws` engine.
//
// Each strategy is the TCP (HTTP/HTTPS) part of a winws profile. The engine
// layer wraps it with the domain filter, the QUIC rule and the Discord voice
// rule, so a strategy only describes *how* the first packets are disguised.
//
// Sources: field reports from Turkish ISPs collected by the SplitWire-Turkey /
// zapret-win-turkey communities (translated to winws v1 syntax), and the
// GoodbyeDPI modes Turkish users have relied on, re-expressed for winws.
// `{engine}` is replaced with the absolute engine directory at runtime.

export type IspFamily =
  | "turktelekom"
  | "superonline"
  | "vodafone"
  | "turksat"
  | "turkcell"
  | "ttmobil"
  | "turknet"
  | "other";

export interface Strategy {
  id: string;
  /** Short human readable name, shown in Advanced settings and logs. */
  name: string;
  args: readonly string[];
}

export const STRATEGIES: readonly Strategy[] = [
  {
    id: "disorder-seqovl",
    name: "Disorder · seqovl",
    args: ["--dpi-desync=multidisorder", "--dpi-desync-split-pos=2", "--dpi-desync-split-seqovl=1"],
  },
  {
    id: "fake-disorder-autottl",
    name: "Fake + disorder · auto TTL",
    // GoodbyeDPI -5 equivalent.
    args: ["--dpi-desync=fake,multidisorder", "--dpi-desync-split-pos=2", "--dpi-desync-autottl"],
  },
  {
    id: "fake-ttl4",
    name: "Fake · TTL 4",
    args: ["--dpi-desync=fake", "--dpi-desync-ttl=4"],
  },
  {
    id: "fake-md5sig",
    name: "Fake · md5sig",
    args: ["--dpi-desync=fake", "--dpi-desync-fooling=md5sig"],
  },
  {
    id: "fake-split-ttl5",
    name: "Fake + split · TTL 5",
    args: ["--dpi-desync=fake,multisplit", "--dpi-desync-split-pos=2", "--dpi-desync-ttl=5"],
  },
  {
    id: "fake-disorder-badseq",
    name: "Fake + disorder · bad seq/sum",
    // GoodbyeDPI -9 equivalent.
    args: ["--dpi-desync=fake,multidisorder", "--dpi-desync-split-pos=2", "--dpi-desync-fooling=badseq,badsum"],
  },
  {
    id: "fake-ttl3",
    name: "Fake · TTL 3",
    args: ["--dpi-desync=fake", "--dpi-desync-ttl=3"],
  },
  {
    id: "fake-md5sig-ttl3",
    name: "Fake · md5sig + TTL 3",
    args: ["--dpi-desync=fake", "--dpi-desync-fooling=md5sig", "--dpi-desync-ttl=3"],
  },
  {
    id: "fake-zero-ttl5",
    name: "Fake (zero) · TTL 5",
    args: ["--dpi-desync=fake", "--dpi-desync-fake-tls=0x00000000", "--dpi-desync-ttl=5"],
  },
  {
    id: "split2",
    name: "Split",
    args: ["--dpi-desync=multisplit", "--dpi-desync-split-pos=2"],
  },
  {
    id: "split-seqovl-pattern",
    name: "Split · seqovl pattern",
    args: [
      "--dpi-desync=multisplit",
      "--dpi-desync-split-pos=1",
      "--dpi-desync-split-seqovl=681",
      "--dpi-desync-split-seqovl-pattern={engine}/tls_clienthello_www_google_com.bin",
    ],
  },
  {
    id: "fake-badseq-autottl",
    name: "Fake ×6 · bad seq + auto TTL",
    args: ["--dpi-desync=fake", "--dpi-desync-fooling=badseq", "--dpi-desync-autottl", "--dpi-desync-repeats=6"],
  },
  {
    id: "fake-ttl1-autottl",
    name: "Fake · TTL 1 + auto TTL",
    args: ["--dpi-desync=fake", "--dpi-desync-ttl=1", "--dpi-desync-autottl=3"],
  },
  {
    id: "fakedsplit-badseq",
    name: "Faked split · bad seq",
    args: ["--dpi-desync=fakedsplit", "--dpi-desync-split-pos=1", "--dpi-desync-fooling=badseq"],
  },
  {
    id: "fake-tlsmod",
    name: "Fake (random TLS) ×6",
    args: [
      "--dpi-desync=fake",
      "--dpi-desync-fake-tls-mod=rnd,dupsid,sni=www.google.com",
      "--dpi-desync-fooling=badseq",
      "--dpi-desync-repeats=6",
    ],
  },
  {
    id: "disorder-midsld",
    name: "Disorder · mid-SLD",
    args: ["--dpi-desync=multidisorder", "--dpi-desync-split-pos=1,midsld"],
  },
];

export const strategyById = (id: string): Strategy | undefined => STRATEGIES.find((s) => s.id === id);

/** What is known to work per ISP, tried first. Everything else follows. */
const ISP_PRIORITY: Record<IspFamily, readonly string[]> = {
  turktelekom: ["disorder-seqovl", "fake-ttl4", "fake-ttl3", "fake-disorder-autottl"],
  superonline: ["disorder-seqovl", "fake-disorder-autottl", "fake-md5sig", "fake-md5sig-ttl3"],
  vodafone: ["fake-split-ttl5", "disorder-seqovl", "split2", "fake-disorder-autottl"],
  turksat: ["disorder-seqovl", "fake-ttl4", "fake-disorder-autottl"],
  turkcell: ["disorder-seqovl", "fake-ttl1-autottl", "fake-disorder-autottl"],
  ttmobil: ["fake-zero-ttl5", "disorder-seqovl", "fake-ttl4"],
  turknet: ["disorder-seqovl", "fake-disorder-autottl", "fake-ttl4"],
  other: [],
};

const ISP_PATTERNS: readonly [RegExp, IspFamily][] = [
  // Order matters: TT Mobil before Türk Telekom, Superonline before Turkcell.
  [/tt ?mobil|avea/i, "ttmobil"],
  [/t[uü]rk ?telekom|ttnet|turk telekomunikasyon/i, "turktelekom"],
  [/superonline/i, "superonline"],
  [/turkcell/i, "turkcell"],
  [/vodafone|borusan/i, "vodafone"],
  [/t[uü]rksat|kablonet/i, "turksat"],
  [/t[uü]rk ?net/i, "turknet"],
];

export function ispFamily(org: string | null | undefined): IspFamily {
  if (!org) return "other";
  for (const [re, fam] of ISP_PATTERNS) if (re.test(org)) return fam;
  return "other";
}

/**
 * Order in which a scan tries strategies: what is known to work for this ISP,
 * then what already worked on the user's other networks, then the rest.
 */
export function scanOrder(family: IspFamily, provenElsewhere: readonly string[] = []): Strategy[] {
  const ids = [...ISP_PRIORITY[family], ...provenElsewhere, ...STRATEGIES.map((s) => s.id)];
  const seen = new Set<string>();
  const out: Strategy[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const s = strategyById(id);
    if (s) out.push(s);
  }
  return out;
}
