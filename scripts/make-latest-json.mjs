#!/usr/bin/env node
// Builds `latest.json` in the Tauri updater manifest format.
// Reads package.json for version, finds the built .app.tar.gz + its .sig,
// and writes a single-platform manifest for darwin-x86_64.
//
// Env vars (optional — falls back to package.json + git):
//   VERSION — semver without leading "v" (e.g. "0.1.1")
//   NOTES   — release notes markdown

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const version = process.env.VERSION || pkg.version;
const notes = process.env.NOTES || `Update to v${version}.`;

const bundleDir = join(
  ROOT,
  "src-tauri",
  "target",
  "x86_64-apple-darwin",
  "release",
  "bundle",
  "macos",
);

const files = readdirSync(bundleDir);
const tarGz = files.find((f) => f.endsWith(".app.tar.gz"));
if (!tarGz) {
  console.error(`No .app.tar.gz in ${bundleDir}. Files:`, files);
  process.exit(1);
}
const sigFile = `${tarGz}.sig`;
if (!files.includes(sigFile)) {
  console.error(`Missing signature file ${sigFile} in ${bundleDir}`);
  process.exit(1);
}

const signature = readFileSync(join(bundleDir, sigFile), "utf8").trim();

const owner = process.env.GITHUB_REPOSITORY || "rokasta12/mahcelayir-app";
const tag = process.env.GITHUB_REF_NAME || `v${version}`;
const downloadUrl = `https://github.com/${owner}/releases/download/${tag}/${encodeURIComponent(tarGz)}`;

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "darwin-x86_64": {
      signature,
      url: downloadUrl,
    },
  },
};

writeFileSync(join(ROOT, "latest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Wrote latest.json for v${version} (${tarGz})`);
