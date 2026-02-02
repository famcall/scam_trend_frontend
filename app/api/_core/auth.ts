import fs from "fs";
import path from "path";
import { isKeyUsable } from "./keyLifecycle";

/* =========================
   Types
========================= */

export type ApiClient = {
  key: string;
  owner: string;
  plan: string;
  scopes: string[];
  rate_limit_per_min: number;
  daily_quota: number;
  active: boolean;

  // lifecycle
  expires_at?: string;
  disabled_at?: string;

  // meta
  env?: string;
};

/* =========================
   Paths
========================= */

const DB_PATH = path.resolve("../scam_trend_collector/data/api_keys.json");

/* =========================
   Loaders
========================= */

function loadClients(): ApiClient[] {
  if (!fs.existsSync(DB_PATH)) return [];

  try {
    const raw = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    if (!raw || !Array.isArray(raw.keys)) return [];
    return raw.keys as ApiClient[];
  } catch {
    return [];
  }
}

/* =========================
   Auth Core
========================= */

/**
 * authenticate
 *
 * - APIキー存在
 * - lifecycle（active / expires / disabled）
 * - scope
 *
 * ❗ rate limit / quota は usage.ts に完全委譲
 */
export function authenticate(
  req: Request,
  requiredScope: string
): ApiClient | null {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return null;

  const clients = loadClients();
  const client = clients.find((c) => c.key === apiKey);
  if (!client) return null;

  // =========================
  // lifecycle（最重要）
  // =========================
  if (!isKeyUsable(client)) return null;

  // =========================
  // scope
  // =========================
  if (!client.scopes || !client.scopes.includes(requiredScope)) {
    return null;
  }

  return client;
}