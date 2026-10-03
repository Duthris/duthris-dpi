// "Extra sites" accepts plain names. For a name the built-in lists don't know,
// the likely addresses (name.com, name.net...) are looked up over DoH, so a
// poisoned ISP resolver can't make a blocked site look like it doesn't exist.

import { GUESS_TLDS, normalizeKeyword } from "@shared/targets";
import { resolveTruth } from "../core/truth";

const MAX_NAMES = 10;

/** name -> the guessed domains that exist. Names with no match map to []. */
export async function guessDomains(names: readonly string[]): Promise<Record<string, string[]>> {
  const keywords = [...new Set(names.map((n) => normalizeKeyword(n)).filter((k): k is string => !!k))].slice(0, MAX_NAMES);
  const candidates = keywords.flatMap((k) => GUESS_TLDS.map((tld) => `${k}.${tld}`));
  const found = await resolveTruth(candidates);
  return Object.fromEntries(keywords.map((k) => [k, GUESS_TLDS.map((tld) => `${k}.${tld}`).filter((d) => found.has(d))]));
}
