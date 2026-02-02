import fs from "fs";
import path from "path";
import { isKeyUsable } from "./keyLifecycle";

/* =========================
   Types
========================= */

type UsageLog = {
  apiKey: string;
  endpoint: string;
  timestamp: string;
};

type UsageState = {
  apiKey: string;
  minuteWindow: number; // epoch ms
  minuteCount: number;
  dayWindow: string; // YYYY-MM-DD
  dayCount: number;
};

type ApiClient = {
  key: string;
  rate_limit_per_min: number;
  daily_quota: number;
  active: boolean;
  expires_at?: string;
  disabled_at?: string;
};

/* =========================
   Paths
========================= */

const DATA_DIR = path.resolve("../scam_trend_collector/data");
const LOG_PATH = path.join(DATA_DIR, "usage_log.json");
const STATE_PATH = path.join(DATA_DIR, "usage_state.json");
const KEY_DB_PATH = path.join(DATA_DIR, "api_keys.json");

/* =========================
   Utils
========================= */

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadJson<T>(p: string, fallback: T): T {
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return fallback;
  }
}

function saveJson(p: string, obj: any) {
  ensureDir();
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/* =========================
   Loaders
========================= */

function loadClients(): ApiClient[] {
  const raw = loadJson<{ keys: ApiClient[] }>(KEY_DB_PATH, { keys: [] });
  return Array.isArray(raw.keys) ? raw.keys : [];
}

/* =========================
   Core
========================= */

/**
 * logUsage
 *
 * - 認証後に必ず呼ばれる
 * - ここで「最終防衛ライン」を張る
 *
 * throws:
 *  - INVALID_API_KEY
 *  - API_KEY_NOT_USABLE
 *  - RATE_LIMIT_EXCEEDED
 *  - DAILY_QUOTA_EXCEEDED
 */
export function logUsage(apiKey: string, endpoint: string) {
  const clients = loadClients();
  const client = clients.find(c => c.key === apiKey);

  if (!client) {
    throw new Error("INVALID_API_KEY");
  }

  // 🔒 lifecycle 最終チェック（auth通過後でも必須）
  if (!isKeyUsable(client)) {
    throw new Error("API_KEY_NOT_USABLE");
  }

  const now = Date.now();
  const today = todayStr();

  const state = loadJson<UsageState[]>(STATE_PATH, []);
  let s = state.find(x => x.apiKey === apiKey);

  if (!s) {
    s = {
      apiKey,
      minuteWindow: now,
      minuteCount: 0,
      dayWindow: today,
      dayCount: 0,
    };
    state.push(s);
  }

  /* ===== window reset ===== */

  if (now - s.minuteWindow >= 60_000) {
    s.minuteWindow = now;
    s.minuteCount = 0;
  }

  if (s.dayWindow !== today) {
    s.dayWindow = today;
    s.dayCount = 0;
  }

  /* ===== enforce ===== */

  if (s.minuteCount >= client.rate_limit_per_min) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }

  if (s.dayCount >= client.daily_quota) {
    throw new Error("DAILY_QUOTA_EXCEEDED");
  }

  /* ===== increment ===== */

  s.minuteCount += 1;
  s.dayCount += 1;

  saveJson(STATE_PATH, state);

  /* ===== logging (best-effort) ===== */

  const logs = loadJson<UsageLog[]>(LOG_PATH, []);
  logs.push({
    apiKey,
    endpoint,
    timestamp: new Date().toISOString(),
  });
  saveJson(LOG_PATH, logs);
}