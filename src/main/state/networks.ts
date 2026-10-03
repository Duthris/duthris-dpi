// What worked on each network, remembered so the next connection on the same
// network is instant and a scan only happens on a network we haven't seen.

import { join } from "node:path";
import type { NetworkProfile, SavedNetwork } from "@shared/types";
import { readJson, writeJson } from "../json-store";
import { dataDir } from "../paths";

const file = (): string => join(dataDir(), "networks.json");
const MAX_NETWORKS = 30;

let cache: Record<string, NetworkProfile> | null = null;

function load(): Record<string, NetworkProfile> {
  cache ??= readJson<Record<string, NetworkProfile>>(file(), {});
  return cache;
}

function save(): void {
  const all = Object.values(load()).sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, MAX_NETWORKS);
  cache = Object.fromEntries(all.map((p) => [p.networkId, p]));
  writeJson(file(), cache);
}

export function getProfile(networkId: string): NetworkProfile | null {
  return load()[networkId] ?? null;
}

export function saveProfile(profile: NetworkProfile): void {
  load()[profile.networkId] = profile;
  save();
}

export function touchProfile(networkId: string): void {
  const p = load()[networkId];
  if (!p) return;
  p.lastUsedAt = Date.now();
  save();
}

export function forgetProfile(networkId: string): void {
  delete load()[networkId];
  save();
}

export function forgetAll(): void {
  cache = {};
  writeJson(file(), cache);
}

export function hasAnyProfile(): boolean {
  return Object.keys(load()).length > 0;
}

/** Strategies that worked elsewhere, most recently used first. Fed into scan order. */
export function provenStrategies(): string[] {
  return Object.values(load())
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .map((p) => p.strategyId)
    .filter((id) => id !== "none");
}

export function listNetworks(): SavedNetwork[] {
  return Object.values(load())
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .map(({ networkId, name, isp, strategyId, scannedAt }) => ({ networkId, name, isp, strategyId, scannedAt }));
}
