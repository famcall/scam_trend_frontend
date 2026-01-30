import fs from "fs";
import path from "path";

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
  minuteWindow: number;   // ms
  minuteCount: number;
  dayWindow: string;      // YYYY-MM-DD
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

function loadJson<T>(p: string, fallback: T): T {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function saveJson(p: string, obj: any) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/* =========================
   Loaders
========================= */

function loadClients(): ApiClient[] {
  const raw = loadJson(KEY_DB_PATH, { keys: [] });
  return raw.keys || [];
}

function loadState(): UsageState[] {
  return loadJson(STATE_PATH, []);
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
   Core Engine
========================= */

export function logUsage(apiKey: string, endpoint: string) {
  const clients = loadClients();
  const client = clients.find(c => c.key === apiKey);

  if (!client) {
    throw new Error("INVALID_API_KEY");
  }

  if (!client.active) {
    throw new Error("API_KEY_DISABLED");
  }

  const now = Date.now();
  const today = todayStr();

  let state = loadState();
  let userState = state.find(s => s.apiKey === apiKey);

  /* ===== Init ===== */
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

  /* ===== Minute Window ===== */
  if (now - userState.minuteWindow >= 60_000) {
    userState.minuteWindow = now;
    userState.minuteCount = 0;
  }

  /* ===== Day Window ===== */
  if (userState.dayWindow !== today) {
    userState.dayWindow = today;
    userState.dayCount = 0;
  }

  /* ===== Enforcement ===== */

  // per-minute rate limit
  if (userState.minuteCount >= client.rate_limit_per_min) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }

  // daily quota
  if (userState.dayCount >= client.daily_quota) {
    throw new Error("DAILY_QUOTA_EXCEEDED");
  }

  /* ===== Increment ===== */
  userState.minuteCount += 1;
  userState.dayCount += 1;

  /* ===== Persist ===== */
  saveState(state);

  /* ===== Log ===== */
  appendLog({
    apiKey,
    endpoint,
    timestamp: new Date().toISOString(),
  });
}