import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

function loadIndex() {
  const basePath = path.resolve("../scam_trend_collector/data");
  const indexPath = path.join(basePath, "index.json");
  if (!fs.existsSync(indexPath)) return null;
  return JSON.parse(fs.readFileSync(indexPath, "utf-8"));
}

export async function GET(req: Request) {
  try {
    const index = loadIndex();
    if (!index) {
      return NextResponse.json(
        { ok: false, error: "index.json not found" },
        { status: 404 }
      );
    }

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
    const minScore = parseInt(url.searchParams.get("minScore") || "0", 10);

    const events = Array.isArray(index?.events) ? index.events : [];

    const filtered = events
      .filter((e: any) => (e?.risk?.score ?? 0) >= minScore)
      .slice(0, limit);

    return NextResponse.json({
      ok: true,
      data: {
        events: filtered,
        total: events.length,
        returned: filtered.length,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        schema: index?.meta?.schema,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "internal_error", message: err?.message ?? "unknown" },
      { status: 500 }
    );
  }
}