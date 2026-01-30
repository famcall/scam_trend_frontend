import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { authenticate } from "@/app/api/_core/auth";   // ← 追加

type AnyObj = Record<string, any>;

function loadIndex(): AnyObj | null {
  const basePath = path.resolve("../scam_trend_collector/data");
  const indexPath = path.join(basePath, "index.json");
  if (!fs.existsSync(indexPath)) return null;
  return JSON.parse(fs.readFileSync(indexPath, "utf-8"));
}

function parseWindowMs(windowParam: string | null): number | null {
  if (!windowParam) return null;
  const m = windowParam.match(/^(\d+)(h|d)$/);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = m[2];
  if (!Number.isFinite(value) || value <= 0) return null;
  if (unit === "h") return value * 60 * 60 * 1000;
  if (unit === "d") return value * 24 * 60 * 60 * 1000;
  return null;
}

function getEventScore(ev: AnyObj): number {
  const s = ev?.risk?.score ?? ev?.risk_score ?? ev?.scam_score ?? 0;
  const n = typeof s === "number" ? s : parseInt(String(s), 10);
  return Number.isFinite(n) ? n : 0;
}

function getEventLevel(ev: AnyObj): string {
  const lvl = ev?.risk?.level;
  if (typeof lvl === "string" && lvl) return lvl;
  const score = getEventScore(ev);
  return score >= 80 ? "critical" : score >= 60 ? "high" : score >= 35 ? "medium" : "low";
}

function getEventTimestampMs(ev: AnyObj): number | null {
  const ts = ev?.timestamp ?? ev?.collected_at ?? ev?.published_at ?? ev?.semantic_checked_at ?? null;
  if (!ts) return null;
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : null;
}

function normalizeStrList(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
}

export async function GET(req: Request) {
  try {
    // =========================
    // 🔐 AUTHENTICATION LAYER
    // =========================
    const client = authenticate(req, "risk.summary");
    if (!client) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const index = loadIndex();
    if (!index) {
      return NextResponse.json(
        { ok: false, error: "index.json not found", hint: "run: python3 index_builder.py" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const windowParam = searchParams.get("window");
    const windowMs = parseWindowMs(windowParam);
    const now = Date.now();

    const events = Array.isArray(index?.events) ? index.events : [];

    const filtered = windowMs
      ? events.filter((ev: AnyObj) => {
          const t = getEventTimestampMs(ev);
          if (t === null) return false;
          return now - t <= windowMs;
        })
      : events;

    const riskLevelDist: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const scoreDist: Record<string, number> = { "0-19": 0, "20-39": 0, "40-59": 0, "60-79": 0, "80-100": 0 };
    const categoryDist: Record<string, number> = {};
    const sourceDist: Record<string, number> = {};

    let sumScore = 0;

    for (const ev of filtered) {
      const score = getEventScore(ev);
      sumScore += score;

      const lvl = getEventLevel(ev);
      if (riskLevelDist[lvl] !== undefined) riskLevelDist[lvl]++;

      if (score < 20) scoreDist["0-19"]++;
      else if (score < 40) scoreDist["20-39"]++;
      else if (score < 60) scoreDist["40-59"]++;
      else if (score < 80) scoreDist["60-79"]++;
      else scoreDist["80-100"]++;

      const cats = normalizeStrList(ev?.risk?.categories ?? ev?.scam_categories);
      for (const c of cats) categoryDist[c] = (categoryDist[c] || 0) + 1;

      const src = typeof ev?.source === "string" ? ev.source : "unknown";
      sourceDist[src] = (sourceDist[src] || 0) + 1;
    }

    const total = filtered.length;
    const avgScore = total > 0 ? sumScore / total : 0;
    const highRiskRatio = total > 0 ? (riskLevelDist.critical + riskLevelDist.high) / total : 0;

    const dominantCategory = Object.entries(categoryDist).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const dominantSource = Object.entries(sourceDist).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return NextResponse.json(
      {
        ok: true,
        client: {
          owner: client.owner,
          plan: client.plan,
        },
        data: {
          window: windowParam || "all",
          total_events: total,
          distributions: {
            risk_level: riskLevelDist,
            risk_score: scoreDist,
            category: categoryDist,
            source: sourceDist,
          },
          indicators: {
            avg_risk_score: Number(avgScore.toFixed(2)),
            high_risk_ratio: Number(highRiskRatio.toFixed(4)),
            dominant_category: dominantCategory,
            dominant_source: dominantSource,
          },
          model: {
            version: "risk_summary_v1",
            type: "statistical",
            description: "summary aggregation for risk product API",
          },
        },
        meta: {
          generatedAt: new Date().toISOString(),
          schema: "risk_summary_api_v1",
          source: "scam_trend_data_platform",
          index_schema: index?.meta?.schema ?? "unknown",
          index_version: index?.meta?.version ?? "unknown",
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "internal_error", message: err?.message ?? "unknown" },
      { status: 500 }
    );
  }
}