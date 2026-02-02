// scam_trend_frontend/scripts/rotate-api-key.ts
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

  // optional metadata
  env?: string; // dev / live / key etc (your db has it)
  note?: string;

  // disable metadata (your db has them)
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

function nowIso() {
  return new Date().toISOString();
}

function loadDb(): ApiKeyDb {
  if (!fs.existsSync(DB_PATH)) throw new Error("api_keys.json not found");
  const raw = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  if (!raw || !Array.isArray(raw.keys)) throw new Error("invalid api_keys.json format");
  return raw as ApiKeyDb;
}

function saveDb(db: ApiKeyDb) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// supports: --k=v, --k v, --flag
function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;

    const eq = a.indexOf("=");
    if (eq !== -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }

    const k = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[k] = next;
      i++;
    } else {
      out[k] = "true";
    }
  }
  return out;
}

function maskKey(k: string) {
  if (k.length <= 10) return "***";
  return `${k.slice(0, 10)}***${k.slice(-6)}`;
}

function isTrue(v?: string) {
  if (!v) return false;
  return v === "true" || v === "1" || v.toLowerCase() === "yes";
}

function validateKeyFormat(key: string) {
  // keep same convention you already enforce in disable/list (rk_...)
  if (!key.startsWith("rk_")) {
    throw new Error("invalid key format (expected rk_...)");
  }
}

/**
 * Generate a new key:
 * - preserves prefix "rk_{plan}_{env}_" when possible
 * - otherwise just "rk_" prefix
 */
function generateKeyFrom(old: ApiKeyRecord) {
  const env = old.env ?? "dev";
  const plan = old.plan ?? "demo";
  const prefix = `rk_${plan}_${env}_`;

  const token = crypto.randomBytes(20).toString("hex"); // 40 chars
  return `${prefix}${token}`;
}

/* =========================
   Main
========================= */

function main() {
  const args = parseArgs(process.argv.slice(2));

  const key = args.key;
  const reason = args.reason || "rotated";
  const dryRun = isTrue(args["dry-run"] ?? args.dryRun);
  const keepOldActive = isTrue(args.keepOldActive);

  if (!key) {
    console.error("❌ --key is required");
    process.exit(1);
  }

  try {
    validateKeyFormat(key);
  } catch (e: any) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }

  const db = loadDb();
  const oldRec = db.keys.find((k) => k.key === key);

  if (!oldRec) {
    console.error("❌ API key not found");
    process.exit(1);
  }

  // Make sure we don't rotate an already disabled key unless user insists (we won't add that option now)
  if (!oldRec.active) {
    console.error("❌ API key is already inactive (rotate target must be active)");
    process.exit(1);
  }

  const newKey = generateKeyFrom(oldRec);

  // sanity: avoid duplicates
  if (db.keys.some((k) => k.key === newKey)) {
    console.error("❌ generated key collided; retry");
    process.exit(1);
  }

  const newRec: ApiKeyRecord = {
    key: newKey,
    owner: oldRec.owner,
    plan: oldRec.plan,
    scopes: [...oldRec.scopes],
    rate_limit_per_min: oldRec.rate_limit_per_min,
    daily_quota: oldRec.daily_quota,
    active: true,
    created_at: nowIso(),
    env: oldRec.env ?? "dev",
    note: oldRec.note
      ? `${oldRec.note} | rotated_from:${maskKey(oldRec.key)}`
      : `rotated_from:${maskKey(oldRec.key)}`
  };

  console.log("About to rotate API key:");
  console.log("----------------------------------------");
  console.log(`old: ${oldRec.key}`);
  console.log(`new: ${dryRun ? maskKey(newRec.key) : newRec.key}`);
  console.log(`owner: ${oldRec.owner}`);
  console.log(`plan: ${oldRec.plan}`);
  console.log(`env: ${oldRec.env ?? "dev"}`);
  console.log(`reason: ${reason}`);
  console.log(`dry-run: ${dryRun}`);
  console.log("----------------------------------------");

  if (dryRun) {
    console.log("✅ dry-run OK (no changes written)");
    console.log("tips: run without --dry-run=true to apply");
    return;
  }

  // Disable old unless keepOldActive=true (rare, but useful for migration windows)
  if (!keepOldActive) {
    oldRec.active = false;
    oldRec.disabled_at = nowIso();
    oldRec.disabled_reason = reason;
    oldRec.note = oldRec.note
      ? `${oldRec.note} | rotated_to:${maskKey(newRec.key)}`
      : `rotated_to:${maskKey(newRec.key)}`;
  }

  db.keys.unshift(newRec);
  saveDb(db);

  console.log("✅ API key rotated");
  console.log("----------------------------------------");
  console.log(`old: ${oldRec.key}`);
  console.log(`old_active: ${oldRec.active}`);
  console.log(`new: ${newRec.key}`);
  console.log(`owner: ${newRec.owner}`);
  console.log(`plan: ${newRec.plan}`);
  console.log(`env: ${newRec.env}`);
  console.log("----------------------------------------");
  console.log("Use header:");
  console.log(`x-api-key: ${newRec.key}`);
}

main();