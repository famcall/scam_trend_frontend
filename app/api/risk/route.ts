import fs from "fs";
import path from "path";

import { authenticate } from "../_core/auth";
import { logUsage } from "../_core/usage";
import { withApiHandler } from "../_core/withApiHandler";

/**
 * Risk API v1
 */

function loadIndex() {
  const basePath = path.resolve("../scam_trend_collector/data");
  const indexPath = path.join(basePath, "index.json");

  if (!fs.existsSync(indexPath)) return null;
  return JSON.parse(fs.readFileSync(indexPath, "utf-8"));
}

export const GET = (req: Request) =>
  withApiHandler(async () => {
    // ============================
    // 🔐 Auth
    // ============================
    const client = authenticate(req, "risk.read");
    if (!client) {
      throw new Error("INVALID_API_KEY");
    }

    // ============================
    // 📊 Usage
    // ============================
    logUsage(client.key, "/api/risk");

    // ============================
    // Params
    // ============================
    const { searchParams } = new URL(req.url);
    const level = searchParams.get("level");
    const minScore = Number(searchParams.get("min_score") || 0);
    const category = searchParams.get("category");

    // ============================
    // Load index
    // ============================
    const index = loadIndex();
    if (!index) {
      throw new Error("INTERNAL_ERROR");
    }

    let events = index.events || [];

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
    // Normalize
    // ============================
    const items = events.map((ev: any) => ({
      event_id: ev.event_id,
      title: ev.title,
      source: ev.source,
      url: ev.url,
      timestamp: ev.timestamp,
      risk: ev.risk,
    }));

    // ============================
    // Response
    // ============================
    return Response.json({
      ok: true,
      data: {
        total: items.length,
        items,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        schema: "risk_api_v1",
        client: {
          owner: client.owner,
          plan: client.plan,
        },
      },
    });
  });