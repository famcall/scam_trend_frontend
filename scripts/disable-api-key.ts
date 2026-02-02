// scam_trend_frontend/scripts/disable-api-key.ts
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
  note?: string;

  // 追加（後方互換。無くても読める）
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

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function safeReadJson(p: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function loadDbOrInit(): ApiKeyDb {
  ensureDir(DATA_DIR);

  if (!fs.existsSync(DB_PATH)) {
    const init: ApiKeyDb = { keys: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2));
    return init;
  }

  const raw = safeReadJson(DB_PATH);
  if (!raw || !Array.isArray(raw.keys)) {
    throw new Error("invalid api_keys.json format (expected { keys: [] })");
  }
  return raw as ApiKeyDb;
}

function backupDb() {
  if (!fs.existsSync(DB_PATH)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(DATA_DIR, `api_keys.backup.${stamp}.json`);
  fs.copyFileSync(DB_PATH, backupPath);
}

function saveDb(db: ApiKeyDb) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const i = a.indexOf("=");
    if (i === -1) out[a.slice(2)] = "true";
    else out[a.slice(2, i)] = a.slice(i + 1);
  }
  return out;
}

function isLikelyKeyFormat(key: string) {
  // rk_* で始まり、ある程度長いhexが入っている想定
  // 例: rk_demo_dev_....(hex)
  if (!key.startsWith("rk_")) return false;
  return key.length >= 20;
}

/* =========================
   Main
========================= */

function main() {
  const args = parseArgs(process.argv.slice(2));

  const key = (args.key || "").trim();
  const reason = (args.reason || "manual disable").trim();
  const dryRun = (args["dry-run"] || "false").toLowerCase() === "true";

  if (!key) {
    console.error("❌ --key is required");
    process.exit(1);
  }

  if (!isLikelyKeyFormat(key)) {
    console.error("❌ invalid key format (expected rk_...)");
    process.exit(1);
  }

  const db = loadDbOrInit();
  const rec = db.keys.find((k) => k.key === key);

  if (!rec) {
    console.error("❌ API key not found");
    process.exit(1);
  }

  if (!rec.active) {
    console.log("ℹ️ API key already inactive");
    console.log("----------------------------------------");
    console.log(`key: ${rec.key}`);
    console.log(`owner: ${rec.owner}`);
    console.log(`plan: ${rec.plan}`);
    console.log(`disabled_at: ${rec.disabled_at ?? "(unknown)"}`);
    console.log(`disabled_reason: ${rec.disabled_reason ?? "(unknown)"}`);
    console.log("----------------------------------------");
    return;
  }

  const nowIso = new Date().toISOString();

  // 変更内容を先に表示（事故防止）
  console.log("About to disable API key:");
  console.log("----------------------------------------");
  console.log(`key: ${rec.key}`);
  console.log(`owner: ${rec.owner}`);
  console.log(`plan: ${rec.plan}`);
  console.log(`reason: ${reason}`);
  console.log(`dry-run: ${dryRun}`);
  console.log("----------------------------------------");

  if (dryRun) {
    console.log("✅ dry-run complete (no changes written)");
    return;
  }

  // バックアップ → 書き込み（JSON破損対策の最低限）
  backupDb();

  rec.active = false;
  rec.disabled_at = nowIso;
  rec.disabled_reason = reason;

  // note は監査ログとして汚さない（必要なら追記するが、分離情報を優先）
  rec.note = rec.note ? rec.note : undefined;

  saveDb(db);

  console.log("✅ API key disabled");
  console.log("----------------------------------------");
  console.log(`key: ${rec.key}`);
  console.log(`owner: ${rec.owner}`);
  console.log(`plan: ${rec.plan}`);
  console.log(`disabled_at: ${rec.disabled_at}`);
  console.log(`disabled_reason: ${rec.disabled_reason}`);
  console.log("----------------------------------------");
}

main();