import type { Language, LanguagePref } from "./types";

const en = {
  "app.name": "Duthris DPI",

  "phase.idle": "Off",
  "phase.idle.sub": "Tap to unblock",
  "phase.preparing": "Getting ready",
  "phase.scanning": "Finding what works here",
  "phase.starting": "Connecting",
  "phase.active": "Protected",
  "phase.healing": "Fixing the connection",
  "phase.waiting-network": "Waiting for internet",
  "phase.stopping": "Stopping",
  "phase.error": "Couldn't connect",

  "scan.dns": "Checking DNS…",
  "scan.baseline": "Checking what's blocked…",
  "scan.step": "Trying {name} · {i}/{n}",

  "active.sub": "{targets} unblocked",
  "active.all": "All websites unblocked",
  "active.since": "for {time}",

  "action.connect": "Connect",
  "action.disconnect": "Disconnect",
  "action.cancel": "Cancel",
  "action.retry": "Try again",
  "action.rescan": "Re-scan",
  "action.fullScan": "Full scan",
  "action.report": "Report",
  "action.relaunchAdmin": "Restart as administrator",
  "action.stopConflicts": "Stop them & connect",
  "action.restartDiscord": "Restart Discord",
  "action.yes": "Yes",
  "action.notNow": "Not now",
  "action.forget": "Forget",
  "action.back": "Back",
  "action.copy": "Copy",
  "action.clear": "Clear",
  "action.save": "Save",
  "action.copied": "Copied",
  "action.reset": "Reset",
  "action.add": "Add",
  "action.later": "Later",
  "action.download": "Download",
  "action.restartUpdate": "Restart & update",

  "error.not-elevated": "Administrator rights are needed to filter network traffic.",
  "error.engine-missing": "Engine files are missing. An antivirus may have removed them — add an exception for the app folder and reinstall.",
  "error.engine-failed": "The engine stopped unexpectedly. The log has the details.",
  "error.driver-blocked": "Windows or your antivirus blocked the WinDivert driver. Kaspersky is the usual cause; Memory Integrity can also block it.",
  "error.conflict": "Another DPI tool is running and would clash with this one:",
  "error.offline": "No internet connection.",
  "error.dns-unavailable": "Couldn't reach any secure DNS server from this network.",
  "error.no-strategy": "None of the built-in methods got through on this network. Try a full scan, or report your ISP so a method can be added.",
  "error.unsupported-arch": "This device's processor isn't supported by the WinDivert driver.",
  "error.unknown": "Something went wrong. The log has the details.",

  "warning.kaspersky": "Kaspersky is installed. It blocks the driver this app relies on, even when disabled.",
  "warning.partial": "Some {targets} servers still didn't answer during the test. A full scan may find a better method.",
  "warning.dns-port-busy": "Another program is using the DNS port, so DNS protection is off.",
  "warning.discord-open": "Discord was already open. Restart it so it reconnects through the bypass.",

  "card.network": "Network",
  "card.method": "Method",
  "card.method.none": "Nothing is blocked here",
  "card.method.auto": "Found automatically {time}",
  "card.method.manual": "Chosen manually",
  "card.method.custom": "Custom",
  "card.dns": "DNS protection",
  "card.appliesTo": "Applies to",
  "card.everything": "All websites",
  "card.moreSites": "+{n} sites",
  "card.unknownIsp": "Unknown ISP",

  "prompt.startup": "Start automatically when Windows starts?",

  "nav.settings": "Settings",
  "nav.logs": "Logs",

  "settings.title": "Settings",
  "settings.general": "General",
  "settings.launchAtStartup": "Start with Windows",
  "settings.launchAtStartup.desc": "Starts quietly in the tray when you sign in.",
  "settings.launchAtStartup.dev": "Available in the installed app.",
  "settings.autoConnect": "Connect on launch",
  "settings.autoConnect.desc": "Turns protection on as soon as the app starts.",
  "settings.closeToTray": "Keep running when closed",
  "settings.closeToTray.desc": "The close button hides the window to the tray.",
  "settings.notifications": "Notifications",
  "settings.language": "Language",
  "settings.language.desc": "“System” follows Windows. Languages other than English and Turkish show English.",
  "settings.language.system": "System",

  "settings.targets": "Where to apply",
  "settings.targets.desc": "Only these services go through the bypass; the rest of your internet is untouched.",
  "settings.allTraffic": "All websites",
  "settings.allTraffic.desc": "Apply to every site instead of only the selected ones.",
  "settings.voice": "Discord voice & video",
  "settings.voice.desc": "Also covers voice channels and calls.",
  "settings.customDomains": "Extra sites",
  "settings.customDomains.desc": "Type a site's name (wattpad) or its address (wattpad.com). For a name, its addresses are found for you. Subdomains are always included.",
  "settings.sites.placeholder": "e.g. wattpad or example.com",
  "settings.sites.added": "{input}: added {domains}",
  "settings.sites.enabled": "{name} is now on in the list above",
  "settings.sites.alreadyOn": "{name} is already on in the list above",
  "settings.sites.notFound": "Couldn't find a site called “{input}”. Try its full address, e.g. {input}.com",
  "settings.sites.invalid": "“{input}” isn't a site name or address",
  "settings.sites.remove": "Remove {domain}",
  "settings.excludeDomains": "Never touch",
  "settings.excludeDomains.desc": "Sites left alone in “All websites” mode.",

  "settings.connection": "Connection",
  "settings.selfHeal": "Self-healing",
  "settings.selfHeal.desc": "Checks the connection now and then and finds a new method if it stops working.",
  "settings.dns": "DNS protection",
  "settings.dns.desc": "Resolves protected sites over encrypted DNS so the ISP can't redirect them.",
  "settings.dns.auto": "Auto",
  "settings.dns.always": "Always",
  "settings.dns.off": "Off",
  "settings.ispLookup": "Recognise my ISP",
  "settings.ispLookup.desc": "Looks up your ISP's name (ipinfo.io) to try its known methods first.",

  "settings.advanced": "Advanced",
  "settings.method": "Method",
  "settings.method.auto": "Automatic (recommended)",
  "settings.method.custom": "Custom arguments",
  "settings.method.custom.desc": "winws desync options, e.g. --dpi-desync=fake --dpi-desync-ttl=4",
  "settings.fullScan.desc": "Tests every method and keeps the fastest. Takes a minute or two.",
  "settings.networks": "Remembered networks",
  "settings.networks.empty": "None yet.",
  "settings.tools": "Tools",
  "settings.openLogs": "Open logs folder",
  "settings.copyDiagnostics": "Copy diagnostics",
  "settings.reset": "Reset everything",
  "settings.reset.desc": "Disconnects, forgets networks and restores default settings.",
  "settings.reset.confirm": "Sure? Click again",

  "settings.about": "About",
  "settings.about.desc": "Free and open source (MIT). Built on zapret (MIT) and WinDivert (LGPL-3.0).",
  "settings.about.source": "Source code",
  "settings.about.version": "Version",
  "settings.update.check": "Check for updates",
  "settings.update.desc": "New versions download by themselves and install when the app restarts.",
  "settings.update.checking": "Checking…",
  "settings.update.current": "Up to date",
  "settings.update.error": "Couldn't check",
  "settings.update.dev": "Updates work in the installed app.",
  "update.ready": "Version {version} is ready. Restart to install it; protection pauses for a few seconds.",
  "update.downloading": "Downloading version {version}… {percent}%",
  "update.manual": "Version {version} is out. This portable copy can't update itself; download the new one from GitHub.",

  "logs.title": "Logs",
  "logs.empty": "Nothing logged yet.",

  "tray.open": "Open",
  "tray.connect": "Connect",
  "tray.disconnect": "Disconnect",
  "tray.rescan": "Re-scan this network",
  "tray.quit": "Quit",

  "notify.connected.title": "Protection is on",
  "notify.connected.body": "{targets} unblocked on {network}.",
  "notify.trayHint.title": "I'm still here",
  "notify.trayHint.body": "Still working in the background. My icon is next to the clock; click ^ if you don't see it.",
  "notify.healed.title": "Connection fixed",
  "notify.healed.body": "Found a new method for {network}.",
  "notify.newNetwork.title": "New network",
  "notify.newNetwork.body": "Finding the right settings for {network}…",
  "notify.failed.title": "Protection is off",
  "notify.update.title": "Update ready",
  "notify.update.body": "Duthris DPI {version} installs the next time the app restarts.",
  "notify.update.manual": "Duthris DPI {version} is out. Download it from GitHub.",

  "time.justNow": "just now",
  "time.minutes": "{n} min ago",
  "time.hours": "{n} h ago",
  "time.days": "{n} d ago",
} as const;

export type I18nKey = keyof typeof en;

const tr: Record<I18nKey, string> = {
  "app.name": "Duthris DPI",

  "phase.idle": "Kapalı",
  "phase.idle.sub": "Engeli kaldırmak için dokun",
  "phase.preparing": "Hazırlanıyor",
  "phase.scanning": "Bu ağda çalışan ayar aranıyor",
  "phase.starting": "Bağlanıyor",
  "phase.active": "Koruma açık",
  "phase.healing": "Bağlantı onarılıyor",
  "phase.waiting-network": "İnternet bekleniyor",
  "phase.stopping": "Durduruluyor",
  "phase.error": "Bağlanılamadı",

  "scan.dns": "DNS kontrol ediliyor…",
  "scan.baseline": "Nelerin engellendiğine bakılıyor…",
  "scan.step": "{name} deneniyor · {i}/{n}",

  "active.sub": "{targets} erişime açık",
  "active.all": "Tüm siteler erişime açık",
  "active.since": "{time} süredir",

  "action.connect": "Bağlan",
  "action.disconnect": "Bağlantıyı kes",
  "action.cancel": "İptal",
  "action.retry": "Tekrar dene",
  "action.rescan": "Yeniden tara",
  "action.fullScan": "Tam tarama",
  "action.report": "Bildir",
  "action.relaunchAdmin": "Yönetici olarak yeniden başlat",
  "action.stopConflicts": "Onları durdur ve bağlan",
  "action.restartDiscord": "Discord'u yeniden başlat",
  "action.yes": "Evet",
  "action.notNow": "Şimdi değil",
  "action.forget": "Unut",
  "action.back": "Geri",
  "action.copy": "Kopyala",
  "action.clear": "Temizle",
  "action.save": "Kaydet",
  "action.copied": "Kopyalandı",
  "action.reset": "Sıfırla",
  "action.add": "Ekle",
  "action.later": "Sonra",
  "action.download": "İndir",
  "action.restartUpdate": "Yeniden başlat ve güncelle",

  "error.not-elevated": "Ağ trafiğini yönlendirebilmek için yönetici izni gerekiyor.",
  "error.engine-missing": "Motor dosyaları eksik. Bir antivirüs silmiş olabilir; uygulama klasörünü istisnalara ekleyip yeniden kurun.",
  "error.engine-failed": "Motor beklenmedik şekilde durdu. Ayrıntılar kayıtlarda.",
  "error.driver-blocked": "Windows ya da antivirüsünüz WinDivert sürücüsünü engelledi. Genelde sebep Kaspersky'dir; Bellek Bütünlüğü de engelleyebilir.",
  "error.conflict": "Çakışacak başka bir DPI aracı çalışıyor:",
  "error.offline": "İnternet bağlantısı yok.",
  "error.dns-unavailable": "Bu ağdan hiçbir güvenli DNS sunucusuna ulaşılamadı.",
  "error.no-strategy": "Hazır yöntemlerin hiçbiri bu ağda işe yaramadı. Tam tarama deneyin ya da internet sağlayıcınızı bildirin, yeni bir yöntem eklensin.",
  "error.unsupported-arch": "Bu cihazın işlemcisi WinDivert sürücüsünü desteklemiyor.",
  "error.unknown": "Bir şeyler ters gitti. Ayrıntılar kayıtlarda.",

  "warning.kaspersky": "Kaspersky yüklü. Kapalıyken bile bu uygulamanın kullandığı sürücüyü engelliyor.",
  "warning.partial": "Test sırasında bazı {targets} sunucuları hâlâ yanıt vermedi. Tam tarama daha iyi bir yöntem bulabilir.",
  "warning.dns-port-busy": "DNS portunu başka bir program kullanıyor, DNS koruması kapalı.",
  "warning.discord-open": "Discord zaten açıktı. Yeniden bağlanması için Discord'u yeniden başlatın.",

  "card.network": "Ağ",
  "card.method": "Yöntem",
  "card.method.none": "Bu ağda engel yok",
  "card.method.auto": "{time} otomatik bulundu",
  "card.method.manual": "Elle seçildi",
  "card.method.custom": "Özel",
  "card.dns": "DNS koruması",
  "card.appliesTo": "Etki alanı",
  "card.everything": "Tüm siteler",
  "card.moreSites": "+{n} site",
  "card.unknownIsp": "Bilinmeyen sağlayıcı",

  "prompt.startup": "Windows açılınca otomatik başlasın mı?",

  "nav.settings": "Ayarlar",
  "nav.logs": "Kayıtlar",

  "settings.title": "Ayarlar",
  "settings.general": "Genel",
  "settings.launchAtStartup": "Windows ile başlat",
  "settings.launchAtStartup.desc": "Oturum açtığınızda sessizce bildirim alanında başlar.",
  "settings.launchAtStartup.dev": "Kurulu uygulamada kullanılabilir.",
  "settings.autoConnect": "Açılışta bağlan",
  "settings.autoConnect.desc": "Uygulama açılır açılmaz korumayı başlatır.",
  "settings.closeToTray": "Kapatınca çalışmaya devam etsin",
  "settings.closeToTray.desc": "Kapat düğmesi pencereyi bildirim alanına gizler.",
  "settings.notifications": "Bildirimler",
  "settings.language": "Dil",
  "settings.language.desc": "“Sistem” Windows'un dilini izler. İngilizce ve Türkçe dışındaki dillerde İngilizce gösterilir.",
  "settings.language.system": "Sistem",

  "settings.targets": "Nerede uygulansın",
  "settings.targets.desc": "Yalnızca bu servisler aşma işleminden geçer; internetinizin geri kalanına dokunulmaz.",
  "settings.allTraffic": "Tüm siteler",
  "settings.allTraffic.desc": "Yalnızca seçilenler yerine her siteye uygula.",
  "settings.voice": "Discord ses ve görüntü",
  "settings.voice.desc": "Ses kanallarını ve aramaları da kapsar.",
  "settings.customDomains": "Ek siteler",
  "settings.customDomains.desc": "Sitenin adını (wattpad) ya da adresini (wattpad.com) yazın. Ad yazarsanız adresleri sizin için bulunur. Alt alan adları her zaman dahildir.",
  "settings.sites.placeholder": "ör. wattpad ya da ornek.com",
  "settings.sites.added": "{input}: {domains} eklendi",
  "settings.sites.enabled": "{name} yukarıdaki listede açıldı",
  "settings.sites.alreadyOn": "{name} yukarıdaki listede zaten açık",
  "settings.sites.notFound": "“{input}” adında bir site bulunamadı. Tam adresini yazmayı deneyin, ör. {input}.com",
  "settings.sites.invalid": "“{input}” bir site adı ya da adresi değil",
  "settings.sites.remove": "{domain} kaldır",
  "settings.excludeDomains": "Asla dokunma",
  "settings.excludeDomains.desc": "“Tüm siteler” modunda dokunulmayacak siteler.",

  "settings.connection": "Bağlantı",
  "settings.selfHeal": "Kendini onar",
  "settings.selfHeal.desc": "Bağlantıyı ara ara kontrol eder, çalışmazsa yeni bir yöntem bulur.",
  "settings.dns": "DNS koruması",
  "settings.dns.desc": "Korunan siteleri şifreli DNS ile çözer, böylece sağlayıcı onları yönlendiremez.",
  "settings.dns.auto": "Otomatik",
  "settings.dns.always": "Her zaman",
  "settings.dns.off": "Kapalı",
  "settings.ispLookup": "Sağlayıcımı tanı",
  "settings.ispLookup.desc": "Bilinen yöntemleri önce denemek için sağlayıcınızın adını öğrenir (ipinfo.io).",

  "settings.advanced": "Gelişmiş",
  "settings.method": "Yöntem",
  "settings.method.auto": "Otomatik (önerilen)",
  "settings.method.custom": "Özel parametreler",
  "settings.method.custom.desc": "winws desync seçenekleri, ör. --dpi-desync=fake --dpi-desync-ttl=4",
  "settings.fullScan.desc": "Tüm yöntemleri dener ve en hızlısını seçer. Bir iki dakika sürer.",
  "settings.networks": "Hatırlanan ağlar",
  "settings.networks.empty": "Henüz yok.",
  "settings.tools": "Araçlar",
  "settings.openLogs": "Kayıt klasörünü aç",
  "settings.copyDiagnostics": "Tanılama bilgisini kopyala",
  "settings.reset": "Her şeyi sıfırla",
  "settings.reset.desc": "Bağlantıyı keser, ağları unutur ve varsayılan ayarlara döner.",
  "settings.reset.confirm": "Emin misiniz? Tekrar tıklayın",

  "settings.about": "Hakkında",
  "settings.about.desc": "Ücretsiz ve açık kaynak (MIT). zapret (MIT) ve WinDivert (LGPL-3.0) üzerine kurulu.",
  "settings.about.source": "Kaynak kod",
  "settings.about.version": "Sürüm",
  "settings.update.check": "Güncellemeleri denetle",
  "settings.update.desc": "Yeni sürümler kendiliğinden iner ve uygulama yeniden başlayınca kurulur.",
  "settings.update.checking": "Denetleniyor…",
  "settings.update.current": "Güncel",
  "settings.update.error": "Denetlenemedi",
  "settings.update.dev": "Güncellemeler kurulu uygulamada çalışır.",
  "update.ready": "{version} sürümü hazır. Kurmak için yeniden başlatın; koruma birkaç saniyeliğine durur.",
  "update.downloading": "{version} sürümü indiriliyor… %{percent}",
  "update.manual": "{version} sürümü çıktı. Bu taşınabilir kopya kendini güncelleyemez; yenisini GitHub'dan indirin.",

  "logs.title": "Kayıtlar",
  "logs.empty": "Henüz kayıt yok.",

  "tray.open": "Aç",
  "tray.connect": "Bağlan",
  "tray.disconnect": "Bağlantıyı kes",
  "tray.rescan": "Bu ağı yeniden tara",
  "tray.quit": "Çıkış",

  "notify.connected.title": "Koruma açık",
  "notify.connected.body": "{network} ağında {targets} erişime açık.",
  "notify.trayHint.title": "Buradayım",
  "notify.trayHint.body": "Arka planda çalışmaya devam ediyorum. Simgem saatin yanında; görünmüyorsa ^ okuna tıklayın.",
  "notify.healed.title": "Bağlantı onarıldı",
  "notify.healed.body": "{network} için yeni bir yöntem bulundu.",
  "notify.newNetwork.title": "Yeni ağ",
  "notify.newNetwork.body": "{network} için doğru ayarlar bulunuyor…",
  "notify.failed.title": "Koruma kapandı",
  "notify.update.title": "Güncelleme hazır",
  "notify.update.body": "Duthris DPI {version}, uygulama bir sonraki açılışında kurulacak.",
  "notify.update.manual": "Duthris DPI {version} çıktı. GitHub'dan indirebilirsiniz.",

  "time.justNow": "az önce",
  "time.minutes": "{n} dk önce",
  "time.hours": "{n} sa önce",
  "time.days": "{n} gün önce",
};

const dictionaries: Record<Language, Record<I18nKey, string>> = { en, tr };

/**
 * "system" becomes Turkish when Windows' primary language is Turkish and
 * English otherwise (including every language without a translation).
 */
export function resolveLanguage(pref: LanguagePref, systemLanguages: readonly string[]): Language {
  if (pref !== "system") return pref;
  return /^tr(-|_|$)/i.test(systemLanguages[0] ?? "") ? "tr" : "en";
}

export function translate(lang: Language, key: I18nKey, vars?: Record<string, string | number>): string {
  const template = dictionaries[lang][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export function relativeTime(lang: Language, ts: number, now = Date.now()): string {
  const min = Math.floor((now - ts) / 60_000);
  if (min < 1) return translate(lang, "time.justNow");
  if (min < 60) return translate(lang, "time.minutes", { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return translate(lang, "time.hours", { n: h });
  return translate(lang, "time.days", { n: Math.floor(h / 24) });
}

/** "Discord", "Discord & Roblox", "Discord, Roblox & 2 more". */
export function joinNames(lang: Language, names: readonly string[]): string {
  const and = lang === "tr" ? "ve" : "&";
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} ${and} ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}
