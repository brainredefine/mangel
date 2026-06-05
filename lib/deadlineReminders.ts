// lib/deadlineReminders.ts
//
// Findet offene Maßnahmen mit erreichter/überschrittener Frist (expected_enddate)
// und schickt je zuständigem Asset Manager eine Sammel-Erinnerung. SERVER ONLY.
// Unterliegt demselben Sende-Guard wie alle Mails (NOTIFICATIONS_ENABLED).

import { supabaseAdmin } from './supabaseAdmin';
import { sendMail } from './mailer';
import { resolveAssetManager } from './assetManagers';

type Row = {
  id: string;
  title: string | null;
  tracking_code: string | null;
  expected_enddate: string | null;
  vendor_status: string | null;
  chosen_tgm: string | null;
  odoo_tenancy_id: number | null;
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

export async function runDeadlineReminders(): Promise<{
  scanned: number;
  due: number;
  amGroups: number;
  sent: number;
}> {
  const { data } = await supabaseAdmin
    .from('tickets')
    .select('id, title, tracking_code, expected_enddate, vendor_status, chosen_tgm, odoo_tenancy_id')
    .not('expected_enddate', 'is', null)
    .neq('status', 'closed')
    .neq('status', 'archived');

  const rows = (data || []) as Row[];
  const now = Date.now();
  const horizon = now + 24 * 3600 * 1000; // fällig in <24h oder bereits überfällig

  const due = rows.filter((r) => {
    if (r.vendor_status === 'completed') return false;
    if (!r.expected_enddate) return false;
    return new Date(r.expected_enddate).getTime() <= horizon;
  });

  // Nach AM gruppieren (kleiner Cache je tenancy, um Odoo-Calls zu sparen).
  const amCache = new Map<number, { name: string; email: string } | null>();
  const groups = new Map<string, { am: { name: string; email: string }; items: Row[] }>();

  for (const r of due) {
    let am: { name: string; email: string } | null = null;
    if (r.odoo_tenancy_id) {
      if (amCache.has(r.odoo_tenancy_id)) {
        am = amCache.get(r.odoo_tenancy_id) ?? null;
      } else {
        am = await resolveAssetManager(r.odoo_tenancy_id);
        amCache.set(r.odoo_tenancy_id, am);
      }
    }
    if (!am) {
      const fallback = (process.env.REMINDER_FALLBACK_EMAIL || '').trim();
      if (!fallback) continue; // kein Empfänger ermittelbar → überspringen
      am = { name: 'Hausverwaltung', email: fallback };
    }
    const g = groups.get(am.email) || { am, items: [] };
    g.items.push(r);
    groups.set(am.email, g);
  }

  let sent = 0;
  for (const [, g] of groups) {
    const lines = g.items
      .map((r) => {
        const overdue = r.expected_enddate ? new Date(r.expected_enddate).getTime() < now : false;
        const datum = r.expected_enddate ? fmtDate(r.expected_enddate) : '—';
        const flag = overdue ? 'ÜBERFÄLLIG' : 'fällig';
        const vendor = r.chosen_tgm ? ` · ${r.chosen_tgm}` : '';
        return `• [${flag} – ${datum}] ${r.title || 'Ohne Titel'} (${r.tracking_code || r.id.slice(0, 8)})${vendor}`;
      })
      .join('\n');

    const subject = `Erinnerung: ${g.items.length} offene Maßnahme(n) mit Frist`;
    const text = `Hallo ${g.am.name},

folgende Maßnahmen haben eine erreichte oder überschrittene Frist und sind noch nicht erledigt:

${lines}

Bitte den Stand beim Dienstleister prüfen.

— Mangelmanagement`;

    const res = await sendMail({ to: g.am.email, subject, text, fromName: 'Mangelmanagement' });
    if (res.sent) sent++;
  }

  return { scanned: rows.length, due: due.length, amGroups: groups.size, sent };
}
