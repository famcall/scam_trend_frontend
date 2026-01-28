import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export async function GET() {
  const basePath = path.resolve("../scam_trend_collector/data");

  const statsPath = path.join(basePath, "stats.json");
  const semanticPath = path.join(basePath, "semantic.json");

  const stats = JSON.parse(fs.readFileSync(statsPath, "utf-8"));
  const semantic = JSON.parse(fs.readFileSync(semanticPath, "utf-8"));

  return NextResponse.json({
    stats,
    semantic,
  });
}
