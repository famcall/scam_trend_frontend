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

function boolOf(v: string | undefined, fallback: boolean) {
  if (v == null) return fallback;
  const t = v.toLowerCase();
  if (["true", "1", "yes"].includes(t)) return true;
  if (["false", "0", "no"].includes(t)) return false;
  return fallback;
}

function splitCsv(s: string | undefined): string[] {
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function loadDb(): ApiKeyDb {
  if (!fs.existsSync(DB_PATH)) return { keys: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    if (!raw || !Array.isArray(raw.keys)) return { keys: [] };
    return { keys: raw.keys as ApiKeyRecord[] };
  } catch {
    return { keys: [] };
  }
}

function maskKey(k: string) {
  if (!k) return "";
  const parts = k.split("_");
  if (parts.length < 3) return `${k.slice(0, 6)}...${k.slice(-6)}`;
  const prefix = parts.slice(0, 3).join("_"); // rk_demo_dev
  return `${prefix}_***${k.slice(-6)}`;
}

function pickEnvFromKey(k: string): string | null {
  const parts = k.split("_");
  if (parts.length < 4) return null;
  return parts[2] || null;
}

/* =========================
   Expiration Helpers
========================= */

function isExpired(k: ApiKeyRecord): boolean {
  if (!k.expires_at) return false;
  return Date.now() > new Date(k.expires_at).getTime();
}

function expiresInDays(k: ApiKeyRecord): number | null {
  if (!k.expires_at) return null;
  const diff = new Date(k.expires_at).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

/* =========================
   Main
========================= */

function main() {
  const args = parseArgs(process.argv.slice(2));

  const owner = args.owner?.trim();
  const plan = args.plan?.trim();
  const env = args.env?.trim().toLowerCase();

  const activeArg = args.active;
  const activeFilter = activeArg == null ? null : boolOf(activeArg, true);

  const expiredArg = args.expired;
  const expiredFilter = expiredArg == null ? null : boolOf(expiredArg, true);

  const scopesAny = splitCsv(args.scope || args.scopes);
  const showKey = boolOf(args.showKey, false);

  const db = loadDb();
  let keys = db.keys || [];

  /* ===== Filters ===== */

  if (owner) keys = keys.filter((k) => k.owner === owner);
  if (plan) keys = keys.filter((k) => k.plan === plan);

  if (activeFilter !== null) {
    keys = keys.filter((k) => k.active === activeFilter);
  }

  if (env) {
    keys = keys.filter((k) => pickEnvFromKey(k.key) === env);
  }

  if (expiredFilter !== null) {
    keys = keys.filter((k) => isExpired(k) === expiredFilter);
  }

  if (scopesAny.length > 0) {
    keys = keys.filter((k) =>
      scopesAny.every((s) => (k.scopes || []).includes(s))
    );
  }

  /* ===== Sort ===== */

  keys.sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  });

  /* ===== Output ===== */

  console.log("✅ API keys");
  console.log("----------------------------------------");
  console.log(`db: ${DB_PATH}`);
  console.log(`count: ${keys.length}`);
  if (owner) console.log(`filter.owner: ${owner}`);
  if (plan) console.log(`filter.plan: ${plan}`);
  if (env) console.log(`filter.env: ${env}`);
  if (activeFilter !== null) console.log(`filter.active: ${activeFilter}`);
  if (expiredFilter !== null) console.log(`filter.expired: ${expiredFilter}`);
  if (scopesAny.length > 0) console.log(`filter.scope(all): ${scopesAny.join(", ")}`);
  console.log("----------------------------------------");

  if (keys.length === 0) {
    console.log("(no keys)");
    return;
  }

  for (const k of keys) {
    const keyStr = showKey ? k.key : maskKey(k.key);
    const envStr = pickEnvFromKey(k.key) ?? "unknown";
    const expired = isExpired(k);
    const daysLeft = expiresInDays(k);

    console.log(`key: ${keyStr}`);
    console.log(`owner: ${k.owner}`);
    console.log(`plan: ${k.plan}`);
    console.log(`env: ${envStr}`);
    console.log(`active: ${k.active}`);
    console.log(`expired: ${expired}`);
    if (k.expires_at) {
      console.log(`expires_at: ${k.expires_at}`);
      console.log(`expires_in_days: ${daysLeft}`);
    } else {
      console.log(`expires_at: never`);
    }
    console.log(`rate_limit_per_min: ${k.rate_limit_per_min}`);
    console.log(`daily_quota: ${k.daily_quota}`);
    console.log(`scopes: ${(k.scopes || []).join(", ")}`);
    console.log(`created_at: ${k.created_at}`);

    if (k.disabled_at) console.log(`disabled_at: ${k.disabled_at}`);
    if (k.disabled_reason) console.log(`disabled_reason: ${k.disabled_reason}`);
    if (k.note) console.log(`note: ${k.note}`);

    console.log("----------------------------------------");
  }

  console.log("tips:");
  console.log("  npm run key:list");
  console.log("  npm run key:list -- --owner=test");
  console.log("  npm run key:list -- --active=false");
  console.log("  npm run key:list -- --expired=true");
  console.log("  npm run key:list -- --env=dev");
  console.log("  npm run key:list -- --scope=risk.summary");
  console.log("  npm run key:list -- --showKey=true");
}

main();