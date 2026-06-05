// lib/ticketMetrics.ts
//
// Shared ticket metrics so the SLA definition and AM mapping stay consistent
// across the backoffice list and the dashboard.

export type PriorityLike = 'low' | 'medium' | 'high';

// SLA-Frist in Tagen je Priorität.
export const SLA_DAYS: Record<PriorityLike, number> = { high: 2, medium: 5, low: 10 };

export function ageInDays(iso: string, now: number = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / 86_400_000);
}

export function isOverdue(
  t: { status: string; priority: PriorityLike; created_at: string },
  now: number = Date.now()
): boolean {
  if (t.status === 'closed' || t.status === 'archived') return false;
  return ageInDays(t.created_at, now) > (SLA_DAYS[t.priority] ?? 7);
}

// Objekt-Referenz → Asset Manager: AD* → Andrea, AC* → Nadine.
export function assetGroupFromRef(ref: string | null | undefined): 'AD' | 'AC' | null {
  const r = (ref || '').trim().toUpperCase();
  if (r.startsWith('AD')) return 'AD';
  if (r.startsWith('AC')) return 'AC';
  return null;
}
