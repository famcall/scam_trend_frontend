import fs from "fs";
import path from "path";

export type ApiClient = {
  key: string;
  owner: string;
  plan: string;
  scopes: string[];
  rate_limit_per_min: number;
  daily_quota: number;
  active: boolean;
};

const DB_PATH = path.resolve("../scam_trend_collector/data/api_keys.json");

/* =========================
   Loaders
========================= */

function loadKeys(): ApiClient[] {
  if (!fs.existsSync(DB_PATH)) return [];
  const raw = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  return raw?.keys || [];
}

/* =========================
   Auth Core
========================= */

export function authenticate(req: Request, scope: string): ApiClient | null {
  const apiKey = req.headers.get("x-api-key");

  if (!apiKey) return null;

  const keys = loadKeys();
  const client = keys.find(k => k.key === apiKey);

  if (!client) return null;
  if (!client.active) return null;

  // scope enforcement
  if (!client.scopes.includes(scope)) return null;

  return client;
}