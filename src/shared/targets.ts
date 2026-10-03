// Services the bypass can be limited to. Matching is by domain (the engine reads
// the TLS SNI / HTTP Host of each new connection), and every entry also covers
// its subdomains, so "discord.com" includes "gateway.discord.com" etc.
//
// Per-application filtering (e.g. "only Discord.exe") is not possible at the
// packet level the engine works on, which is why services are defined by the
// domains they talk to.

export type ServiceId =
  | "discord"
  | "youtube"
  | "instagram"
  | "x"
  | "facebook"
  | "tiktok"
  | "reddit"
  | "twitch"
  | "wikipedia"
  | "roblox";

export interface TargetService {
  id: ServiceId;
  name: string;
  /** Other names people type for it in "Extra sites" ("twitter", "insta"...). */
  aliases?: readonly string[];
  domains: readonly string[];
  /** Hosts used to verify that a strategy really works. Must answer HTTPS. */
  probeHosts: readonly string[];
  /** Voice/video runs over UDP and needs its own rule. */
  voice?: boolean;
}

// The switches in Settings: services that get blocked somewhere often enough to
// deserve one. Only Discord is on by default. The first entry is the fallback
// when nothing is selected.
export const SERVICES: readonly TargetService[] = [
  {
    id: "discord",
    name: "Discord",
    domains: [
      "discord.com",
      "discordapp.com",
      "discord.gg",
      "discordapp.net",
      "discord.media",
      "discordcdn.com",
      "discord.dev",
      "discord.new",
      "discord.gift",
      "discord.gifts",
      "discord.co",
      "discord.design",
      "discord.store",
      "discord.tools",
      "discordstatus.com",
      "discordsays.com",
      "discordactivities.com",
      "discord-activities.com",
      "discordpartygames.com",
      "discordmerch.com",
      "dis.gd",
      "discord-attachments-uploads-prd.storage.googleapis.com",
    ],
    // discord.com serves the app and API, gateway is the realtime socket, the
    // CDN serves avatars and attachments, and updates.* is what the desktop
    // client hangs on ("Checking for updates...") when it is blocked.
    probeHosts: ["discord.com", "gateway.discord.gg", "cdn.discordapp.com", "updates.discord.com"],
    voice: true,
  },
  {
    id: "youtube",
    name: "YouTube",
    aliases: ["yt"],
    domains: [
      "youtube.com",
      "youtu.be",
      "youtube-nocookie.com",
      "ytimg.com",
      "ggpht.com",
      "googlevideo.com",
      "youtubei.googleapis.com",
      "youtube.googleapis.com",
      "jnn-pa.googleapis.com",
      "yt3.googleusercontent.com",
    ],
    // googlevideo.com carries the video itself; its redirector answers HTTPS.
    probeHosts: ["www.youtube.com", "i.ytimg.com", "redirector.googlevideo.com"],
  },
  {
    id: "instagram",
    name: "Instagram",
    aliases: ["insta", "ig"],
    // Part of the media comes from Meta's shared CDN (fbcdn.net).
    domains: ["instagram.com", "cdninstagram.com", "instagr.am", "ig.me", "fbcdn.net"],
    probeHosts: ["www.instagram.com", "static.cdninstagram.com"],
  },
  {
    id: "x",
    name: "X (Twitter)",
    aliases: ["twitter"],
    domains: ["x.com", "twitter.com", "twimg.com", "t.co", "twttr.com"],
    probeHosts: ["x.com", "abs.twimg.com", "api.x.com"],
  },
  {
    id: "facebook",
    name: "Facebook",
    aliases: ["fb", "messenger"],
    domains: ["facebook.com", "fb.com", "fb.me", "fbcdn.net", "facebook.net", "fbsbx.com", "messenger.com", "m.me"],
    probeHosts: ["www.facebook.com", "static.xx.fbcdn.net"],
  },
  {
    id: "tiktok",
    name: "TikTok",
    domains: [
      "tiktok.com",
      "tiktokv.com",
      "tiktokv.eu",
      "tiktokcdn.com",
      "tiktokcdn-eu.com",
      "tiktokcdn-us.com",
      "ttwstatic.com",
      "byteoversea.com",
      "ibytedtos.com",
      "ibyteimg.com",
      "muscdn.com",
    ],
    probeHosts: ["www.tiktok.com"],
  },
  {
    id: "reddit",
    name: "Reddit",
    domains: ["reddit.com", "redd.it", "redditmedia.com", "redditstatic.com"],
    probeHosts: ["www.reddit.com", "www.redditstatic.com"],
  },
  {
    id: "twitch",
    name: "Twitch",
    domains: ["twitch.tv", "ttvnw.net", "jtvnw.net", "twitchcdn.net", "twitchsvc.net", "ext-twitch.tv", "live-video.net"],
    probeHosts: ["www.twitch.tv", "gql.twitch.tv"],
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    aliases: ["wiki", "vikipedi"],
    domains: [
      "wikipedia.org",
      "wikimedia.org",
      "wikidata.org",
      "wiktionary.org",
      "wikiquote.org",
      "wikibooks.org",
      "wikisource.org",
      "wikinews.org",
      "wikiversity.org",
      "wikivoyage.org",
      "mediawiki.org",
    ],
    probeHosts: ["www.wikipedia.org", "upload.wikimedia.org"],
  },
  {
    id: "roblox",
    name: "Roblox",
    domains: [
      "roblox.com",
      "rbxcdn.com",
      "rbxinfra.com",
      "rbxinfra.net",
      "rbxtrk.com",
      "robloxlabs.com",
      "roblox.qq.com",
      "arkoselabs.com",
      "funcaptcha.com",
    ],
    probeHosts: ["www.roblox.com", "apis.roblox.com", "tr.rbxcdn.com"],
  },
];

export const serviceById = (id: ServiceId): TargetService | undefined => SERVICES.find((s) => s.id === id);

export interface KnownSite {
  name: string;
  /** What people type for it. */
  keywords: readonly string[];
  domains: readonly string[];
}

// Sites without a switch that "Extra sites" still recognises by name, so typing
// "wattpad" also adds the CDN it loads from. Messaging apps are here for their
// web versions: their desktop and mobile apps don't send a readable site name.
export const KNOWN_SITES: readonly KnownSite[] = [
  { name: "Wattpad", keywords: ["wattpad"], domains: ["wattpad.com", "wattpad.net", "wattpadstatic.com"] },
  { name: "Telegram", keywords: ["telegram", "tg"], domains: ["telegram.org", "t.me", "telegram.me", "telesco.pe"] },
  { name: "WhatsApp", keywords: ["whatsapp"], domains: ["whatsapp.com", "whatsapp.net", "wa.me"] },
  { name: "Signal", keywords: ["signal"], domains: ["signal.org", "whispersystems.org"] },
  { name: "Spotify", keywords: ["spotify"], domains: ["spotify.com", "scdn.co", "spotifycdn.com"] },
  { name: "Pinterest", keywords: ["pinterest"], domains: ["pinterest.com", "pinimg.com"] },
  { name: "Imgur", keywords: ["imgur"], domains: ["imgur.com"] },
  { name: "Medium", keywords: ["medium"], domains: ["medium.com"] },
  { name: "SoundCloud", keywords: ["soundcloud"], domains: ["soundcloud.com", "sndcdn.com"] },
  { name: "Vimeo", keywords: ["vimeo"], domains: ["vimeo.com", "vimeocdn.com"] },
  { name: "LinkedIn", keywords: ["linkedin"], domains: ["linkedin.com", "licdn.com"] },
  { name: "Tumblr", keywords: ["tumblr"], domains: ["tumblr.com"] },
  { name: "Patreon", keywords: ["patreon"], domains: ["patreon.com"] },
  { name: "Steam", keywords: ["steam"], domains: ["steampowered.com", "steamcommunity.com", "steamstatic.com"] },
  { name: "Internet Archive", keywords: ["archive", "wayback"], domains: ["archive.org", "archive.ph", "archive.today"] },
  { name: "Proton", keywords: ["proton", "protonmail"], domains: ["proton.me", "protonmail.com"] },
  { name: "Ekşi Sözlük", keywords: ["eksisozluk", "eksi"], domains: ["eksisozluk.com"] },
];

/** Domains that are never touched in "all traffic" mode. Users can extend it. */
export const DEFAULT_EXCLUDES: readonly string[] = ["turkiye.gov.tr"];

const DOMAIN_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

/** Accepts "https://www.Example.com/path", "*.example.com" or "example.com". */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s || s.startsWith("#")) return null;
  s = s.replace(/^[a-z]+:\/\//, "");
  s = s.split(/[/?#:]/)[0] ?? "";
  s = s.replace(/^\*\./, "").replace(/\.$/, "");
  return DOMAIN_RE.test(s) ? s : null;
}

export function parseDomainList(text: string): string[] {
  const out = new Set<string>();
  for (const line of text.split(/[\s,;]+/)) {
    const d = normalizeDomain(line);
    if (d) out.add(d);
  }
  return [...out];
}

const FOLD: Record<string, string> = { ı: "i", İ: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g", ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c" };

/** "Ekşi Sözlük" -> "eksisozluk": typed names are compared in this form. */
export function normalizeKeyword(input: string): string | null {
  const s = input
    .trim()
    .replace(/[ıİşŞğĞüÜöÖçÇ]/g, (c) => FOLD[c] ?? c)
    .toLowerCase()
    .replace(/[\s_]+/g, "");
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(s) ? s : null;
}

/** "X (Twitter)" -> "x" */
const compactName = (name: string): string => normalizeKeyword(name.replace(/\(.*\)/, "")) ?? "";

export type SiteInput =
  | { kind: "domain"; input: string; domain: string }
  | { kind: "service"; input: string; service: TargetService }
  | { kind: "known"; input: string; site: KnownSite }
  /** A name we don't know; the main process looks for name.com and similar. */
  | { kind: "keyword"; input: string; keyword: string }
  | { kind: "invalid"; input: string };

/** Decides what one typed entry is: an address, a known service or site, or an unknown name. */
export function classifySite(input: string): SiteInput {
  if (input.includes(".") || input.includes("/")) {
    // "www.example.com" -> "example.com": subdomains are included anyway, and the
    // site's other hosts (cdn., api.) usually hang off the bare domain.
    const domain = normalizeDomain(input)?.replace(/^www\.(?=[^.]+\.)/, "");
    return domain ? { kind: "domain", input, domain } : { kind: "invalid", input };
  }
  const keyword = normalizeKeyword(input);
  if (!keyword) return { kind: "invalid", input };
  const service = SERVICES.find((s) => s.id === keyword || compactName(s.name) === keyword || s.aliases?.includes(keyword));
  if (service) return { kind: "service", input, service };
  const site = KNOWN_SITES.find((k) => k.keywords.includes(keyword) || compactName(k.name) === keyword);
  if (site) return { kind: "known", input, site };
  return { kind: "keyword", input, keyword };
}

/** "discord, wattpad.com  x" -> ["discord", "wattpad.com", "x"] */
export const splitSiteInput = (text: string): string[] => text.split(/[\s,;]+/).filter(Boolean);

/** Top-level domains tried for a name we don't know, most likely first. */
export const GUESS_TLDS: readonly string[] = ["com", "net", "org", "com.tr", "tv", "io"];

/** True when `host` equals `domain` or is a subdomain of it. */
export function hostMatches(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return h === domain || h.endsWith(`.${domain}`);
}
