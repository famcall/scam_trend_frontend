import fs from "fs";
import path from "path";

/* =========================
   Types
========================= */

type ApiKeyRecord = {
  key: string;
  owner: string;
  plan: string;
  scopes: string[];
  rate_limit_per_min: number;
  daily_quota: number;
  active: boolean;
  created_at: string;

  // lifecycle
  expires_at?: string;
  rotated_at?: string;

  // meta
  env?: string;
  note?: string;

  // disable info
  disabled_at?: string;
  disabled_reason?: string;
};

type ApiKeyDb = {
  keys: ApiKeyRecord[];
};

/* =========================
   Paths
========================= */

const DATA_DIR = path.resolve("../scam_trend_collector/data");
const DB_PATH = path.join(DATA_DIR, "api_keys.json");

/* =========================
   Utils
========================= */

function loadDb(): ApiKeyDb {
  if (!fs.existsSync(DB_PATH)) return { keys: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    if (!raw || !Array.isArray(raw.keys)) return { keys: [] };
    return { keys: raw.keys };
  } catch {
    return { keys: [] };
  }
}

function daysUntil(dateIso: string): number {
  const diffMs = new Date(dateIso).getTime() - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

function maskKey(k: string) {
  if (!k) return "";
  const parts = k.split("_");
  if (parts.length < 3) return `${k.slice(0, 6)}...${k.slice(-6)}`;
  return `${parts.slice(0, 3).join("_")}_***${k.slice(-6)}`;
}

/* =========================
   Policy (Single Source)
========================= */

// 忖度なし最適解
const NOTIFY_DAYS = [7, 0]; // 7日前 / 当日

/* =========================
   Main
========================= */

function main() {
  const db = loadDb();
  const now = new Date();

  const targets = db.keys.filter((k) => {
    if (!k.active) return false;
    if (!k.expires_at) return false; // 無期限は対象外
    if (k.disabled_at) return false;
    return true;
  });

  const hits: {
    key: ApiKeyRecord;
    daysLeft: number;
  }[] = [];

  for (const k of targets) {
    const daysLeft = daysUntil(k.expires_at!);
    if (NOTIFY_DAYS.includes(daysLeft)) {
      hits.push({ key: k, daysLeft });
    }
  }

  console.log("🔔 API Key Expiration Check");
  console.log("----------------------------------------");
  console.log(`time: ${now.toISOString()}`);
  console.log(`db: ${DB_PATH}`);
  console.log(`checked: ${targets.length}`);
  console.log(`matched: ${hits.length}`);
  console.log("----------------------------------------");

  if (hits.length === 0) {
    console.log("✅ no expiring keys");
    return;
  }

  for (const { key: k, daysLeft } of hits) {
    console.log(`⚠️  API KEY ${daysLeft === 0 ? "EXPIRED TODAY" : "EXPIRING SOON"}`);
    console.log(`key: ${maskKey(k.key)}`);
    console.log(`owner: ${k.owner}`);
    console.log(`plan: ${k.plan}`);
    console.log(`env: ${k.env ?? "unknown"}`);
    console.log(`expires_at: ${k.expires_at}`);
    console.log(`expires_in_days: ${daysLeft}`);
    console.log("----------------------------------------");
  }

  console.log("tips:");
  console.log("  - hook this script to cron / GitHub Actions");
  console.log("  - replace console.log with email / Slack / webhook");
}

main();