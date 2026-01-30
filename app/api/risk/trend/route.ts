import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

import { authenticate } from "../_core/auth";
import { logUsage } from "../_core/usage";

/**
 * Trend API v1
 * ============================
 * トレンド・統計・分布・予測用API
 *
 * GET /api/trend
 * GET /api/trend?window=7d
 *
 * 用途:
 * - ダッシュボード
 * - レポーティング
 * - B2B/B2G分析API
 * - 予測モデル入力
 * - BI連携
 * - 行政/企業向けデータ供給API
 */

// ============================
// Index Loader
// ============================

function loadIndex() {
  const basePath = path.resolve("../scam_trend_collector/data");
  const indexPath = path.join(basePath, "index.json");

  if (!fs.existsSync(indexPath)) return null;
  return JSON.parse(fs.readFileSync(indexPath, "utf-8"));
}

// ============================
// Time Window Parser
// ============================

function parseWindow(window: string | null): number | null {
  if (!window) return null;

  // 例: 24h / 7d / 30d
  const m = window.match(/^(\d+)(h|d)$/);
  if (!m) return null;

  const value = Number(m[1]);
  const unit = m[2];

  if (unit === "h") return value * 60 * 60 * 1000;
  if (unit === "d") return value * 24 * 60 * 60 * 1000;

  return null;
}

// ============================
// GET Handler
// ============================

export async function GET(req: Request) {
  try {
    // ============================
    // 🔐 Step 3-1: Authentication
    // ============================
    const client = authenticate(req, "trend");

    if (!client) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    // ============================
    // 📊 Step 3-2: Usage Logging
    // ============================
    logUsage(client.key, "/api/trend");

    // ============================
    // Params
    // ============================
    const { searchParams } = new URL(req.url);
    const windowParam = searchParams.get("window"); // 例: 7d, 24h

    // ============================
    // Load Index
    // ============================
    const index = loadIndex();

    if (!index) {
      return NextResponse.json(
        {
          ok: false,
          error: "index.json not found",
          hint: "run: python3 index_builder.py",
        },
        { status: 404 }
      );
    }

    const now = Date.now();
    const windowMs = parseWindow(windowParam);

    const events = index?.events || [];

    // ============================
    // Time Window Filter
    // ============================
    let filteredEvents = events;

    if (windowMs) {
      filteredEvents = events.filter((ev: any) => {
        const ts =
          ev?.timestamp ||
          ev?.collected_at ||
          ev?.published_at;

        if (!ts) return false;

        const t = new Date(ts).getTime();
        if (isNaN(t)) return false;

        return now - t <= windowMs;
      });
    }

    // ============================
    // Trend Aggregation
    // ============================

    const riskDist: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const categoryDist: Record<string, number> = {};
    const sourceDist: Record<string, number> = {};
    const scoreDist: Record<string, number> = {
      "0-19": 0,
      "20-39": 0,
      "40-59": 0,
      "60-79": 0,
      "80-100": 0,
    };

    for (const ev of filteredEvents) {
      const riskScore =
        ev?.risk?.score ??
        ev?.scam_score ??
        0;

      const riskLevel =
        ev?.risk?.level ??
        (riskScore >= 80 ? "critical" :
         riskScore >= 60 ? "high" :
         riskScore >= 35 ? "medium" : "low");

      if (riskDist[riskLevel] !== undefined) {
        riskDist[riskLevel]++;
      }

      // スコア分布
      if (riskScore < 20) scoreDist["0-19"]++;
      else if (riskScore < 40) scoreDist["20-39"]++;
      else if (riskScore < 60) scoreDist["40-59"]++;
      else if (riskScore < 80) scoreDist["60-79"]++;
      else scoreDist["80-100"]++;

      // カテゴリ分布
      const cats =
        ev?.risk?.categories ??
        ev?.scam_categories ??
        [];

      if (Array.isArray(cats)) {
        for (const c of cats) {
          categoryDist[c] = (categoryDist[c] || 0) + 1;
        }
      }

      // ソース分布
      const src = ev?.source || "unknown";
      sourceDist[src] = (sourceDist[src] || 0) + 1;
    }

    // ============================
    // Trend Indicators (v1 model)
    // ============================

    const trendSignals = {
      highRiskRatio:
        filteredEvents.length > 0
          ? (riskDist.critical + riskDist.high) / filteredEvents.length
          : 0,

      dominantCategory:
        Object.entries(categoryDist).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,

      dominantSource:
        Object.entries(sourceDist).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    };

    // ============================
    // Product API Response
    // ============================

    return NextResponse.json({
      ok: true,

      data: {
        window: windowParam || "all",
        total_events: filteredEvents.length,

        distributions: {
          risk_level: riskDist,
          risk_score: scoreDist,
          category: categoryDist,
          source: sourceDist,
        },

        indicators: {
          high_risk_ratio: Number(trendSignals.highRiskRatio.toFixed(4)),
          dominant_category: trendSignals.dominantCategory,
          dominant_source: trendSignals.dominantSource,
        },

        model: {
          version: "trend_model_v1",
          type: "statistical",
          description: "rule-based trend aggregation",
        },
      },

      meta: {
        generatedAt: new Date().toISOString(),
        schema: "trend_api_v1",
        source: "scam_trend_data_platform",
        index_version: index?.meta?.version || "unknown",
        client: {
          owner: client.owner,
          plan: client.plan,
        }
      },
    });

  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: err?.message ?? "unknown_error",
      },
      { status: 500 }
    );
  }
}