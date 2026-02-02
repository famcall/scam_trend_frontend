// scam_trend_frontend/app/api/_core/usage.ts
import fs from "fs";
import path from "path";

type UsageLog = {
  apiKey: string;
  endpoint: string;
  timestamp: string;
};

type UsageState = {
  apiKey: string;
  minuteWindow: number; // ms
  minuteCount: number;
  dayWindow: string; // YYYY-MM-DD
  dayCount: number;
};

type ApiClient = {
  key: string;
  owner: string;
  plan: string;
  scopes: string[];
  rate_limit_per_min: number;
  daily_quota: number;
  active: boolean;
};

const DATA_DIR = path.resolve("../scam_trend_collector/data");
const LOG_PATH = path.join(DATA_DIR, "usage_log.json");
const STATE_PATH = path.join(DATA_DIR, "usage_state.json");
const KEY_DB_PATH = path.join(DATA_DIR, "api_keys.json");

/* =========================
   Utils
========================= */

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
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
  ensureDir(DATA_DIR);
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

function loadState(): UsageState[] {
  return loadJson<UsageState[]>(STATE_PATH, []);
}

function saveState(state: UsageState[]) {
  saveJson(STATE_PATH, state);
}

function appendLog(entry: UsageLog) {
  const logs = loadJson<UsageLog[]>(LOG_PATH, []);
  logs.push(entry);
  saveJson(LOG_PATH, logs);
}

/* =========================
   Core
========================= */

export function logUsage(apiKey: string, endpoint: string) {
  const clients = loadClients();
  const client = clients.find((c) => c.key === apiKey);

  if (!client) throw new Error("INVALID_API_KEY");
  if (!client.active) throw new Error("API_KEY_DISABLED");

  const now = Date.now();
  const today = todayStr();

  const state = loadState();
  let userState = state.find((s) => s.apiKey === apiKey);

  if (!userState) {
    userState = {
      apiKey,
      minuteWindow: now,
      minuteCount: 0,
      dayWindow: today,
      dayCount: 0,
    };
    state.push(userState);
  }

  // minute window reset
  if (now - userState.minuteWindow >= 60_000) {
    userState.minuteWindow = now;
    userState.minuteCount = 0;
  }

  // day window reset
  if (userState.dayWindow !== today) {
    userState.dayWindow = today;
    userState.dayCount = 0;
  }

  // enforce
  if (userState.minuteCount >= client.rate_limit_per_min) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }
  if (userState.dayCount >= client.daily_quota) {
    throw new Error("DAILY_QUOTA_EXCEEDED");
  }

  // increment
  userState.minuteCount += 1;
  userState.dayCount += 1;

  saveState(state);
  appendLog({
    apiKey,
    endpoint,
    timestamp: new Date().toISOString(),
  });
}