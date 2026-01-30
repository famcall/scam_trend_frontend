import { NextResponse } from "next/server";
import { loadIndex } from "../_lib/indexLoader";

/**
 * Alert API v1
 * ============================
 * GET /api/alert?min_score=70&level=high
 * - index.json の events から高リスクを抽出して返す
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const minScore = Number(searchParams.get("min_score") || 70);
    const level = searchParams.get("level"); // high | critical | medium | low

    const index = loadIndex();
    if (!index) {
      return NextResponse.json(
        { ok: false, error: "index.json not found", hint: "run: python3 index_builder.py" },
        { status: 404 }
      );
    }

    const events = Array.isArray(index?.events) ? index.events : [];

    const filtered = events.filter((ev: any) => {
      const riskScore = ev?.risk?.score ?? 0;
      const riskLevel = ev?.risk?.level ?? "low";
      if (riskScore < minScore) return false;
      if (level && riskLevel !== level) return false;
      return true;
    });

    const normalized = filtered.map((ev: any) => ({
      event_id: ev?.event_id,
      title: ev?.title,
      source: ev?.source,
      url: ev?.url,
      timestamp: ev?.timestamp,
      risk: {
        score: ev?.risk?.score ?? 0,
        level: ev?.risk?.level ?? "low",
        confidence: ev?.risk?.confidence ?? null,
        categories: ev?.risk?.categories ?? [],
      },
    }));

    return NextResponse.json({
      ok: true,
      data: {
        active_alerts: normalized.length,
        items: normalized,
      },
      meta: {
        schema: "alert_api_v1",
        type: "push_ready",
        generatedAt: new Date().toISOString(),
        source: "scam_trend_data_platform",
        index_version: index?.meta?.version ?? "unknown",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "internal_error", message: err?.message ?? "unknown_error" },
      { status: 500 }
    );
  }
}