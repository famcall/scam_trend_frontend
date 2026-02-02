import fs from "fs";
import path from "path";
import crypto from "crypto";

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

  // 🔐 lifecycle
  expires_at?: string;   // demo / enterprise のみ
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

// NOTE:
// - frontend repo から collector 側の data を直接操作する設計
// - 本番では ENV / DB / KMS 等に差し替える
const DATA_DIR = path.resolve("../scam_trend_collector/data");
const DB_PATH = path.join(DATA_DIR, "api_keys.json");

/* =========================
   File Utils
========================= */

function ensureDir(p: string) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

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

function saveDb(db: ApiKeyDb) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/* =========================
   Key Generator
========================= */

function genKey(prefix: string) {
  // 48 hex chars = 十分な強度 + 目視可能
  const rand = crypto.randomBytes(24).toString("hex");
  return `${prefix}_${rand}`;
}

function uniqKey(db: ApiKeyDb, prefix: string) {
  for (let i = 0; i < 10; i++) {
    const k = genKey(prefix);
    if (!db.keys.some((x) => x.key === k)) return k;
  }
  throw new Error("FAILED_TO_GENERATE_UNIQUE_KEY");
}

/* =========================
   CLI Args
========================= */

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const idx = a.indexOf("=");
    if (idx === -1) out[a.slice(2)] = "true";
    else out[a.slice(2, idx)] = a.slice(idx + 1);
  }
  return out;
}

function splitCsv(v?: string): string[] {
  if (!v) return [];
  return v.split(",").map((x) => x.trim()).filter(Boolean);
}

function boolOf(v: string | undefined, fallback: boolean) {
  if (v == null) return fallback;
  const t = v.toLowerCase();
  if (["true", "1", "yes"].includes(t)) return true;
  if (["false", "0", "no"].includes(t)) return false;
  return fallback;
}

function intOf(v: string | undefined, fallback: number) {
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/* =========================
   Plan Preset (Single Source of Truth)
========================= */

function preset(plan: string) {
  // ⚠️ ここが「商品設計の真実」
  switch (plan) {
    case "developer":
      return {
        prefix: "rk_dev",
        rate_limit_per_min: 60,
        daily_quota: 10_000,
        scopes: ["risk.read", "risk.events", "risk.summary", "risk.trend"],
        expires_days: undefined, // 無期限
      };

    case "demo":
      return {
        prefix: "rk_demo",
        rate_limit_per_min: 30,
        daily_quota: 3_000,
        scopes: ["risk.read", "risk.summary"],
        expires_days: 30,
      };

    case "enterprise":
      return {
        prefix: "rk_live",
        rate_limit_per_min: 300,
        daily_quota: 200_000,
        scopes: ["risk.read", "risk.events", "risk.summary", "risk.trend"],
        expires_days: 90,
      };

    default:
      return {
        prefix: "rk_custom",
        rate_limit_per_min: 30,
        daily_quota: 3_000,
        scopes: ["risk.read"],
        expires_days: 30,
      };
  }
}

/* =========================
   Expiration Logic
========================= */

function calcExpiresAt(days?: number): string | undefined {
  if (!days) return undefined;
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

/* =========================
   Main
========================= */

function main() {
  const args = parseArgs(process.argv.slice(2));

  const owner = args.owner || "unknown-owner";
  const plan = args.plan || "demo";
  const env = (args.env || "dev").toLowerCase(); // dev | live | staging
  const note = args.note || "";

  const p = preset(plan);

  // 原則 preset 優先
  const rate_limit_per_min = intOf(args.rate, p.rate_limit_per_min);
  const daily_quota = intOf(args.quota, p.daily_quota);

  const cliScopes = splitCsv(args.scopes);
  const scopes = cliScopes.length > 0 ? cliScopes : p.scopes;

  const active = boolOf(args.active, true);

  const db = loadDb();
  const prefix = `${p.prefix}_${env}`;
  const key = args.key || uniqKey(db, prefix);

  const createdAt = new Date().toISOString();
  const expiresAt = calcExpiresAt(p.expires_days);

  const record: ApiKeyRecord = {
    key,
    owner,
    plan,
    scopes,
    rate_limit_per_min,
    daily_quota,
    active,
    created_at: createdAt,
    expires_at: expiresAt,
    env,
    note: note || undefined,
  };

  db.keys.push(record);
  saveDb(db);

  // ===== Output (copy-paste friendly) =====
  console.log("✅ API key issued");
  console.log("--------------------------------------------------");
  console.log(`key: ${record.key}`);
  console.log(`owner: ${record.owner}`);
  console.log(`plan: ${record.plan}`);
  console.log(`env: ${record.env}`);
  console.log(`active: ${record.active}`);
  console.log(`rate_limit_per_min: ${record.rate_limit_per_min}`);
  console.log(`daily_quota: ${record.daily_quota}`);
  console.log(`scopes: ${record.scopes.join(", ")}`);
  console.log(`expires_at: ${record.expires_at ?? "never"}`);
  console.log("--------------------------------------------------");
  console.log("Use header:");
  console.log(`x-api-key: ${record.key}`);
}

main();