import { NextResponse } from "next/server";
import { addWebhook, listWebhooks, setWebhookEnabled } from "../../_lib/webhookStore";

/**
 * Webhook Registry API v1
 * ============================
 * GET  /api/alert/webhook              -> list
 * POST /api/alert/webhook              -> register
 * POST /api/alert/webhook?id=xxx&enabled=false -> enable/disable
 */

export async function GET() {
  const items = listWebhooks();
  return NextResponse.json({
    ok: true,
    data: { count: items.length, items },
    meta: { schema: "webhook_registry_v1", generatedAt: new Date().toISOString() },
  });
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const enabledParam = searchParams.get("enabled");

    // enable/disable
    if (id && enabledParam !== null) {
      const enabled = enabledParam === "true";
      const updated = setWebhookEnabled(id, enabled);
      if (!updated) {
        return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        data: { item: updated },
        meta: { schema: "webhook_registry_v1", generatedAt: new Date().toISOString() },
      });
    }

    // register
    const body = await req.json().catch(() => ({}));
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : undefined;

    if (!url || !url.startsWith("http")) {
      return NextResponse.json(
        { ok: false, error: "invalid_url", hint: "body: { url: 'https://...' }" },
        { status: 400 }
      );
    }

    const created = addWebhook({ url, note });

    return NextResponse.json({
      ok: true,
      data: { item: created },
      meta: { schema: "webhook_registry_v1", generatedAt: new Date().toISOString() },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "internal_error", message: err?.message ?? "unknown_error" },
      { status: 500 }
    );
  }
}