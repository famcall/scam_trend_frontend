import fs from "fs";
import path from "path";

export function loadIndex() {
  const basePath = path.resolve("../scam_trend_collector/data");
  const indexPath = path.join(basePath, "index.json");

  if (!fs.existsSync(indexPath)) return null;

  const raw = fs.readFileSync(indexPath, "utf-8");
  return JSON.parse(raw);
}