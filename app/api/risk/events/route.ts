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

function toInt(v: string | null, fallback: number) {
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
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
    const client = authenticate(req, "risk.events");
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

    const limit = clamp(toInt(searchParams.get("limit"), 50), 1, 200);
    const offset = clamp(toInt(searchParams.get("offset"), 0), 0, 1000000);

    const minScore = clamp(toInt(searchParams.get("minScore"), 0), 0, 100);
    const maxScore = clamp(toInt(searchParams.get("maxScore"), 100), 0, 100);

    const levelParams = searchParams.getAll("level").filter(Boolean);
    const allowedLevels = new Set(["critical", "high", "medium", "low"]);
    const levels = new Set(levelParams.filter((x) => allowedLevels.has(x)));

    const categories = new Set(searchParams.getAll("category").filter(Boolean));
    const sources = new Set(searchParams.getAll("source").filter(Boolean));

    const windowMs = parseWindowMs(searchParams.get("window"));
    const now = Date.now();

    const sort = (searchParams.get("sort") || "score_desc").toLowerCase();
    const events = Array.isArray(index?.events) ? index.events : [];

    let filtered = events.filter((ev: AnyObj) => {
      const score = getEventScore(ev);
      if (score < minScore || score > maxScore) return false;

      if (levels.size > 0) {
        const lvl = getEventLevel(ev);
        if (!levels.has(lvl)) return false;
      }

      if (categories.size > 0) {
        const evCats = normalizeStrList(ev?.risk?.categories ?? ev?.scam_categories);
        if (!evCats.some((c) => categories.has(c))) return false;
      }

      if (sources.size > 0) {
        const src = typeof ev?.source === "string" ? ev.source : "unknown";
        if (!sources.has(src)) return false;
      }

      if (windowMs) {
        const t = getEventTimestampMs(ev);
        if (t === null) return false;
        if (now - t > windowMs) return false;
      }

      return true;
    });

    if (sort === "time_desc") {
      filtered.sort((a: AnyObj, b: AnyObj) => {
        const ta = getEventTimestampMs(a) ?? 0;
        const tb = getEventTimestampMs(b) ?? 0;
        return tb - ta;
      });
    } else {
      filtered.sort((a: AnyObj, b: AnyObj) => {
        const sa = getEventScore(a);
        const sb = getEventScore(b);
        if (sb !== sa) return sb - sa;
        const ta = getEventTimestampMs(a) ?? 0;
        const tb = getEventTimestampMs(b) ?? 0;
        return tb - ta;
      });
    }

    const totalFiltered = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    return NextResponse.json(
      {
        ok: true,
        client: {
          owner: client.owner,
          plan: client.plan,
        },
        data: {
          events: paged,
          total: events.length,
          matched: totalFiltered,
          returned: paged.length,
          paging: {
            limit,
            offset,
            nextOffset: offset + paged.length < totalFiltered ? offset + paged.length : null,
          },
        },
        meta: {
          generatedAt: new Date().toISOString(),
          schema: index?.meta?.schema ?? "unknown",
          indexVersion: index?.meta?.version ?? "unknown",
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