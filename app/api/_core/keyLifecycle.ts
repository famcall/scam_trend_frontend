/* =========================
   Types
========================= */

export type ApiKeyLike = {
  active: boolean;

  // lifecycle
  expires_at?: string;
  disabled_at?: string;
  rotated_at?: string;

  // meta (optional but future-safe)
  env?: string;
  plan?: string;
};

/* =========================
   Time Helpers
========================= */

function nowMs() {
  return Date.now();
}

function parseMs(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/* =========================
   Lifecycle Checks
========================= */

export function isExpired(expires_at?: string): boolean {
  const t = parseMs(expires_at);
  if (t == null) return false;
  return nowMs() > t;
}

export function isDisabled(disabled_at?: string): boolean {
  if (!disabled_at) return false;
  return true; // 時刻は意味を持たない。存在＝無効
}

/**
 * 将来用：
 * - rotated_at が「強制切替期限」を表す場合に使える
 * - 今は未使用だが、設計として残す
 */
export function isRotated(rotated_at?: string): boolean {
  if (!rotated_at) return false;
  return true;
}

/* =========================
   Public API
========================= */

/**
 * isKeyUsable
 *
 * ✅ APIが処理してよいかの「唯一の判定点」
 *
 * - active=false → NG
 * - disabled_at → NG
 * - expires_at 超過 → NG
 *
 * ❗ scope / rate / quota はここでは扱わない
 */
export function isKeyUsable(key: ApiKeyLike): boolean {
  if (!key.active) return false;
  if (isDisabled(key.disabled_at)) return false;
  if (isExpired(key.expires_at)) return false;

  return true;
}

/**
 * isKeyNearExpiry
 *
 * notify / alert 用
 * 「使えるが、そろそろ危ない」
 */
export function isKeyNearExpiry(
  expires_at?: string,
  withinDays: number = 7
): boolean {
  const t = parseMs(expires_at);
  if (t == null) return false;

  const diffMs = t - nowMs();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);

  return diffDays > 0 && diffDays <= withinDays;
}