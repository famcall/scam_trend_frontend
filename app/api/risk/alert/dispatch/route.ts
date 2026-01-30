import { NextResponse } from "next/server";
import { loadIndex } from "../../_lib/indexLoader";
import { listWebhooks } from "../../_lib/webhookStore";

/**
 * Dispatch API v1
 * ============================
 * POST /api/alert/dispatch?min_score=70
 *
 * - 高リスクイベントを抽出
 * - 有効Webhookへ一括POST
 * - 結果を返す（成功/失敗）
 */

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const minScore = Number(searchParams.get("min_score") || 70);

    const index = loadIndex();
    if (!index) {
      return NextResponse.json(
        { ok: false, error: "index.json not found", hint: "run: python3 index_builder.py" },
        { status: 404 }
      );
    }

    const events = Array.isArray(index?.events) ? index.events : [];
    const hooks = listWebhooks().filter((h) => h.enabled);

    if (hooks.length === 0) {
      return NextResponse.json(
        { ok: false, error: "no_webhooks", hint: "POST /api/alert/webhook to register" },
        { status: 400 }
      );
    }

    const alerts = events
      .filter((ev: any) => (ev?.risk?.score ?? 0) >= minScore)
      .map((ev: any) => ({
        event_id: ev?.event_id,
        title: ev?.title,
        source: ev?.source,
        url: ev?.url,
        timestamp: ev?.timestamp,
        risk: ev?.risk ?? {},
      }));

    const payload = {
      schema: "alert_push_v1",
      generatedAt: new Date().toISOString(),
      min_score: minScore,
      count: alerts.length,
      items: alerts,
    };

    const results = await Promise.all(
      hooks.map(async (h) => {
        try {
          const res = await fetch(h.url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });

          return {
            id: h.id,
            url: h.url,
            ok: res.ok,
            status: res.status,
          };
        } catch (e: any) {
          return {
            id: h.id,
            url: h.url,
            ok: false,
            status: 0,
            error: e?.message ?? "network_error",
          };
        }
      })
    );

    return NextResponse.json({
      ok: true,
      data: {
        webhooks: hooks.length,
        pushed_alerts: alerts.length,
        results,
      },
      meta: {
        schema: "dispatch_api_v1",
        generatedAt: new Date().toISOString(),
        source: "scam_trend_data_platform",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "internal_error", message: err?.message ?? "unknown_error" },
      { status: 500 }
    );
  }
}