import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

import { authenticate } from "../_core/auth";
import { logUsage } from "../_core/usage";

/**
 * Risk API v1
 * ============================
 * 防止・検知・審査・フィルタ用API
 *
 * GET /api/risk
 * GET /api/risk?level=high
 * GET /api/risk?min_score=60
 * GET /api/risk?category=direct_scam
 *
 * 用途:
 * - 行政注意喚起
 * - 企業審査
 * - セキュリティフィルタ
 * - データ連携
 * - リアルタイム防止
 */

function loadIndex() {
  const basePath = path.resolve("../scam_trend_collector/data");
  const indexPath = path.join(basePath, "index.json");

  if (!fs.existsSync(indexPath)) return null;
  return JSON.parse(fs.readFileSync(indexPath, "utf-8"));
}

export async function GET(req: Request) {
  try {
    // ============================
    // 🔐 Auth
    // ============================
    const client = authenticate(req, "risk");

    if (!client) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    // ============================
    // 📊 Usage Log
    // ============================
    logUsage(client.key, "/api/risk");

    // ============================
    // Params
    // ============================
    const { searchParams } = new URL(req.url);

    const level = searchParams.get("level");        // low/medium/high/critical
    const minScore = Number(searchParams.get("min_score") || 0);
    const category = searchParams.get("category"); // direct_scam etc

    // ============================
    // Load index
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

    let events = index?.events || [];

    // ============================
    // Filtering
    // ============================
    events = events.filter((ev: any) => {
      const riskScore = ev?.risk?.score ?? 0;
      const riskLevel = ev?.risk?.level ?? "low";
      const cats = ev?.risk?.categories ?? [];

      if (minScore && riskScore < minScore) return false;
      if (level && riskLevel !== level) return false;
      if (category && !cats.includes(category)) return false;

      return true;
    });

    // ============================
    // Normalization
    // ============================
    const normalized = events.map((ev: any) => ({
      event_id: ev.event_id,
      title: ev.title,
      source: ev.source,
      url: ev.url,
      timestamp: ev.timestamp,
      risk: {
        score: ev?.risk?.score,
        level: ev?.risk?.level,
        confidence: ev?.risk?.confidence,
        categories: ev?.risk?.categories,
      },
    }));

    // ============================
    // Response
    // ============================
    return NextResponse.json({
      ok: true,

      data: {
        total: normalized.length,
        items: normalized,
      },

      meta: {
        generatedAt: new Date().toISOString(),
        schema: "risk_api_v1",
        source: "scam_trend_data_platform",
        client: {
          owner: client.owner,
          plan: client.plan,
        },
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