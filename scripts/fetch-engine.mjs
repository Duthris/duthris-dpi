// Downloads the zapret release this app is pinned to, verifies its checksum and
// extracts only the files the app needs into resources/engine/.
//
// Binaries are never committed: anyone can rebuild the installer and check that
// what ships is byte-for-byte the upstream release.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ZAPRET = {
  version: "v72.13",
  url: "https://github.com/bol-van/zapret/releases/download/v72.13/zapret-v72.13.zip",
  sha256: "c493e33a0dc4eba23a8686efdaba55f59755ad6ade3564aebd9d13f4c65e2e0c",
};

// Path inside the archive -> file name in resources/engine/.
const FILES = {
  "binaries/windows-x86_64/winws.exe": "winws.exe",
  "binaries/windows-x86_64/cygwin1.dll": "cygwin1.dll",
  "binaries/windows-x86_64/WinDivert.dll": "WinDivert.dll",
  "binaries/windows-x86_64/WinDivert64.sys": "WinDivert64.sys",
  "files/fake/tls_clienthello_www_google_com.bin": "tls_clienthello_www_google_com.bin",
  "files/fake/quic_initial_www_google_com.bin": "quic_initial_www_google_com.bin",
  "docs/LICENSE.txt": "LICENSE-zapret.txt",
};

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = join(root, ".cache");
const outDir = join(root, "resources", "engine");
const stampFile = join(outDir, "VERSION");
const archive = join(cacheDir, `zapret-${ZAPRET.version}.zip`);

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

if (existsSync(stampFile) && readFileSync(stampFile, "utf8").trim() === ZAPRET.version) {
  const missing = Object.values(FILES).filter((f) => !existsSync(join(outDir, f)));
  if (missing.length === 0) {
    console.log(`engine: zapret ${ZAPRET.version} already in place`);
    process.exit(0);
  }
}

mkdirSync(cacheDir, { recursive: true });

if (!existsSync(archive) || sha256(readFileSync(archive)) !== ZAPRET.sha256) {
  console.log(`engine: downloading ${ZAPRET.url}`);
  const res = await fetch(ZAPRET.url, { redirect: "follow" });
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
}

const actual = sha256(readFileSync(archive));
if (actual !== ZAPRET.sha256) {
  rmSync(archive, { force: true });
  throw new Error(`checksum mismatch for ${archive}\n  expected ${ZAPRET.sha256}\n  actual   ${actual}`);
}

const extractDir = join(cacheDir, "extract");
rmSync(extractDir, { recursive: true, force: true });
mkdirSync(extractDir, { recursive: true });

// Windows 10+ ships bsdtar, which reads zip archives. No extra dependency needed.
const prefix = `zapret-${ZAPRET.version}`;
execFileSync("tar", ["-xf", archive, "-C", extractDir, ...Object.keys(FILES).map((p) => `${prefix}/${p}`)], {
  stdio: "inherit",
});

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const [from, to] of Object.entries(FILES)) {
  copyFileSync(join(extractDir, prefix, from), join(outDir, to));
}
writeFileSync(stampFile, `${ZAPRET.version}\n`);
rmSync(extractDir, { recursive: true, force: true });

console.log(`engine: zapret ${ZAPRET.version} extracted to resources/engine/`);
