// scam_trend_frontend/scripts/issue-api-key.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";

type ApiKeyRecord = {
  key: string;
  owner: string;
  plan: string;
  scopes: string[];
  rate_limit_per_min: number;
  daily_quota: number;
  active: boolean;
  created_at: string;
  note?: string;
};

type ApiKeyDb = {
  keys: ApiKeyRecord[];
};

const DATA_DIR = path.resolve("../scam_trend_collector/data");
const DB_PATH = path.join(DATA_DIR, "api_keys.json");

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
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

function genKey(prefix = "rk") {
  // 例: rk_live_3f2a... (運用上、目視しやすい形式)
  const rand = crypto.randomBytes(24).toString("hex"); // 48 chars
  return `${prefix}_${rand}`;
}

function uniqKey(db: ApiKeyDb, prefix: string) {
  for (let i = 0; i < 10; i++) {
    const k = genKey(prefix);
    if (!db.keys.some((x) => x.key === k)) return k;
  }
  throw new Error("FAILED_TO_GENERATE_UNIQUE_KEY");
}

function parseArgs(argv: string[]) {
  // node scripts/issue-api-key.ts --owner=xxx --plan=demo --env=dev --active=true --note="..."
  const out: Record<string, string> = {};
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const idx = a.indexOf("=");
    if (idx === -1) {
      out[a.slice(2)] = "true";
    } else {
      out[a.slice(2, idx)] = a.slice(idx + 1);
    }
  }
  return out;
}

function splitCsv(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function boolOf(v: string | undefined, fallback: boolean) {
  if (v == null) return fallback;
  const t = v.toLowerCase();
  if (t === "true" || t === "1" || t === "yes") return true;
  if (t === "false" || t === "0" || t === "no") return false;
  return fallback;
}

function intOf(v: string | undefined, fallback: number) {
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function preset(plan: string) {
  // 最適解：plan が商品設計の“真実”になるようにここで固定
  // scope は endpoint と一致させてブレないようにする
  if (plan === "developer") {
    return {
      rate_limit_per_min: 60,
      daily_quota: 10000,
      scopes: ["risk.read", "risk.events", "risk.summary", "risk.trend"],
      prefix: "rk_dev",
    };
  }
  if (plan === "demo") {
    return {
      rate_limit_per_min: 30,
      daily_quota: 3000,
      scopes: ["risk.read", "risk.summary"],
      prefix: "rk_demo",
    };
  }
  if (plan === "enterprise") {
    return {
      rate_limit_per_min: 300,
      daily_quota: 200000,
      scopes: ["risk.read", "risk.events", "risk.summary", "risk.trend"],
      prefix: "rk_live",
    };
  }
  // unknown plan fallback
  return {
    rate_limit_per_min: 30,
    daily_quota: 3000,
    scopes: ["risk.read"],
    prefix: "rk_custom",
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const owner = args.owner || "unknown-owner";
  const plan = args.plan || "demo";

  const env = (args.env || "dev").toLowerCase(); // dev|live など
  const note = args.note || "";

  const p = preset(plan);

  // 上書きしたい場合のみCLI指定（基本は preset を優先）
  const rate_limit_per_min = intOf(args.rate, p.rate_limit_per_min);
  const daily_quota = intOf(args.quota, p.daily_quota);

  // scopes は、指定があればそれを採用（ただし空はNG）
  const scopes = splitCsv(args.scopes);
  const finalScopes = scopes.length > 0 ? scopes : p.scopes;

  const active = boolOf(args.active, true);

  const db = loadDb();
  const prefix = `${p.prefix}_${env}`;
  const key = args.key || uniqKey(db, prefix);

  const rec: ApiKeyRecord = {
    key,
    owner,
    plan,
    scopes: finalScopes,
    rate_limit_per_min,
    daily_quota,
    active,
    created_at: new Date().toISOString(),
    note: note || undefined,
  };

  db.keys.push(rec);
  saveDb(db);

  // stdout: コピペしやすい形で出す（これを控える）
  console.log("✅ API key issued");
  console.log("--------------------------------------------------");
  console.log(`key: ${rec.key}`);
  console.log(`owner: ${rec.owner}`);
  console.log(`plan: ${rec.plan}`);
  console.log(`active: ${rec.active}`);
  console.log(`rate_limit_per_min: ${rec.rate_limit_per_min}`);
  console.log(`daily_quota: ${rec.daily_quota}`);
  console.log(`scopes: ${rec.scopes.join(", ")}`);
  console.log("--------------------------------------------------");
  console.log("Use header:");
  console.log(`x-api-key: ${rec.key}`);
}

main();