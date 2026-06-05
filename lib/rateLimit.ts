// lib/rateLimit.ts
//
// Einfacher In-Memory-Ratelimiter (Fixed Window) pro Server-Instanz.
// Schützt die öffentlichen, account-losen Endpunkte vor Brute-Force / Spam.
// Hinweis: In-Memory => bei mehreren Instanzen gilt das Limit pro Instanz.
// Für größere Skalierung später auf DB/Redis-basiert umstellen.

import { headers } from 'next/headers';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  const now = Date.now();

  // Gelegentliches Aufräumen, damit die Map nicht unbegrenzt wächst.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
  }

  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, retryAfter: 0 };
}

// Client-IP aus den Request-Headern (nur im Request-Kontext aufrufbar).
export async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get('x-forwarded-for') || '';
    return fwd.split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
  } catch {
    return 'unknown';
  }
}
