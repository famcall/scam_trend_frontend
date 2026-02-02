// scam_trend_frontend/scripts/plan.ts
export type EnvName = "dev" | "live";

export type PlanName = "developer" | "starter" | "business" | "enterprise" | "demo";

export type PlanConfig = {
  plan: PlanName;
  rate_limit_per_min: number;
  daily_quota: number;
  scopes: string[];
  keyPrefix: string; // 例: rk_demo / rk_live / rk_biz
};

const PLAN_TABLE: Record<PlanName, PlanConfig> = {
  // 無料〜低額：導入障壁を下げる（ただし過剰に開けない）
  developer: {
    plan: "developer",
    rate_limit_per_min: 60,
    daily_quota: 10_000,
    scopes: ["risk.read", "risk.summary"],
    keyPrefix: "rk_dev",
  },

  // 有料の入口：events まで開ける
  starter: {
    plan: "starter",
    rate_limit_per_min: 120,
    daily_quota: 50_000,
    scopes: ["risk.read", "risk.events", "risk.summary"],
    keyPrefix: "rk_start",
  },

  // 本命：全部開ける（trend含む）
  business: {
    plan: "business",
    rate_limit_per_min: 300,
    daily_quota: 200_000,
    scopes: ["risk.read", "risk.events", "risk.summary", "risk.trend"],
    keyPrefix: "rk_biz",
  },

  // 個別見積もり（上限値は運用で調整）
  enterprise: {
    plan: "enterprise",
    rate_limit_per_min: 600,
    daily_quota: 1_000_000,
    scopes: ["risk.read", "risk.events", "risk.summary", "risk.trend"],
    keyPrefix: "rk_ent",
  },

  // demo は「販売用の試用」扱い（絞る）
  demo: {
    plan: "demo",
    rate_limit_per_min: 30,
    daily_quota: 3_000,
    scopes: ["risk.read", "risk.summary"],
    keyPrefix: "rk_demo",
  },
};

export function normalizeEnv(v: string | undefined): EnvName {
  const t = (v || "dev").toLowerCase();
  return t === "live" ? "live" : "dev";
}

export function normalizePlan(v: string | undefined): PlanName {
  const t = (v || "demo").toLowerCase();
  if (t === "developer") return "developer";
  if (t === "starter") return "starter";
  if (t === "business") return "business";
  if (t === "enterprise") return "enterprise";
  if (t === "demo") return "demo";
  // 不明は demo 扱い（事故るより安全）
  return "demo";
}

export function getPlanConfig(plan: PlanName): PlanConfig {
  return PLAN_TABLE[plan];
}

export function makeKeyPrefix(plan: PlanName, env: EnvName): string {
  const cfg = getPlanConfig(plan);
  // 例: rk_demo_dev / rk_biz_live
  return `${cfg.keyPrefix}_${env}`;
}