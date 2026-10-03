import { joinNames, translate } from "./i18n";
import { serviceById } from "./targets";
import type { Language, Settings } from "./types";

/** "Discord", "Discord & Roblox", "All websites"... for status lines and notifications. */
export function targetsLabel(lang: Language, s: Pick<Settings, "allTraffic" | "services" | "customDomains">): string {
  if (s.allTraffic) return translate(lang, "card.everything");
  const names = s.services.map((id) => serviceById(id)?.name).filter((n): n is string => !!n);
  const extra = s.customDomains.length;
  if (extra === 1 && s.customDomains[0]) names.push(s.customDomains[0]);
  else if (extra > 1) names.push(translate(lang, "card.moreSites", { n: extra }));
  return joinNames(lang, names.length ? names : ["Discord"]);
}
