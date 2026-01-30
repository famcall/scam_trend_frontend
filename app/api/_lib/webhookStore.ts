import fs from "fs";
import path from "path";

export type WebhookTarget = {
  id: string;
  url: string;
  enabled: boolean;
  createdAt: string;
  note?: string;
};

const STORE_DIR = path.resolve("data");
const STORE_PATH = path.join(STORE_DIR, "webhooks.json");

function ensureStore() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(
      STORE_PATH,
      JSON.stringify({ schema: "webhooks_v1", items: [] }, null, 2),
      "utf-8"
    );
  }
}

export function listWebhooks(): WebhookTarget[] {
  ensureStore();
  const raw = fs.readFileSync(STORE_PATH, "utf-8");
  const json = JSON.parse(raw);
  const items = json?.items;
  return Array.isArray(items) ? items : [];
}

export function saveWebhooks(items: WebhookTarget[]) {
  ensureStore();
  fs.writeFileSync(
    STORE_PATH,
    JSON.stringify({ schema: "webhooks_v1", items }, null, 2),
    "utf-8"
  );
}

export function addWebhook(input: { url: string; note?: string }) {
  const items = listWebhooks();
  const now = new Date().toISOString();

  // 重複登録を防ぐ
  const exists = items.find((x) => x.url === input.url);
  if (exists) return exists;

  const id = `wh_${Math.random().toString(16).slice(2)}_${Date.now()}`;

  const webhook: WebhookTarget = {
    id,
    url: input.url,
    enabled: true,
    createdAt: now,
    note: input.note,
  };

  items.push(webhook);
  saveWebhooks(items);
  return webhook;
}

export function setWebhookEnabled(id: string, enabled: boolean) {
  const items = listWebhooks();
  const target = items.find((x) => x.id === id);
  if (!target) return null;

  target.enabled = enabled;
  saveWebhooks(items);
  return target;
}