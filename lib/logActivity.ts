// lib/logActivity.ts
//
// Ticket-Aktivitätsprotokoll — SERVER ONLY. Best-effort: ein Fehler beim Loggen
// darf nie die eigentliche Aktion blockieren.

import { supabaseAdmin } from './supabaseAdmin';

export type ActivityType =
  | 'created'
  | 'status'
  | 'vendor_status'
  | 'message'
  | 'beauftragung'
  | 'note';

export async function logActivity(opts: {
  ticketId: string;
  type: ActivityType;
  detail?: string | null;
  actorId?: string | null;
  actorName?: string | null;
}): Promise<void> {
  try {
    await supabaseAdmin.from('ticket_activity').insert({
      ticket_id: opts.ticketId,
      type: opts.type,
      detail: opts.detail ?? null,
      actor_id: opts.actorId ?? null,
      actor_name: opts.actorName ?? null,
    });
  } catch (e) {
    console.error('[logActivity] Fehler', e);
  }
}
