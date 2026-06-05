// lib/tenantMail.ts
//
// Tenant notifications — SERVER ONLY. The actual sending + the safety guard
// live in lib/mailer.ts; the AM resolution in lib/assetManagers.ts.

import { supabaseAdmin } from './supabaseAdmin';
import { sendMail } from './mailer';
import { resolveAssetManager } from './assetManagers';

export type TenantNotifyKind = 'created' | 'status' | 'message';

const STATUS_LABEL_DE: Record<string, string> = {
  new: 'Eingegangen',
  open: 'Angenommen',
  in_progress: 'In Bearbeitung',
  closed: 'Abgeschlossen',
  archived: 'Abgeschlossen',
};

function trackUrl(code: string): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (!base) return null;
  return `${base}/tickets/track?code=${encodeURIComponent(code)}`;
}

export async function notifyTenant(
  ticketId: string,
  kind: TenantNotifyKind
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const { data: ticket } = await supabaseAdmin
      .from('tickets')
      .select(
        'id, title, status, tracking_code, contact_email, tenant_message, ticket_type, odoo_tenancy_id'
      )
      .eq('id', ticketId)
      .single();

    if (!ticket) return { sent: false, reason: 'ticket_not_found' };

    const email = (ticket.contact_email || '').trim();
    if (!email) return { sent: false, reason: 'no_tenant_email' };

    const code = ticket.tracking_code || '—';
    const link = trackUrl(code);
    const linkLine = link ? `\nStatus verfolgen: ${link}` : '';
    const codeLine = `\nIhr Tracking-Code: ${code}`;
    const art = ticket.ticket_type === 'request' ? 'Anfrage' : 'Mangelmeldung';
    const betreff = ticket.title || '—';

    // Unterschrift = zuständige(r) Asset Manager(in) (AD → Andrea, AC → Nadine).
    const am = await resolveAssetManager(ticket.odoo_tenancy_id);
    const gruss = `Mit freundlichen Grüßen\n${am ? `${am.name}\n${am.email}` : 'Ihre Hausverwaltung'}`;

    let subject = '';
    let text = '';

    if (kind === 'created') {
      subject = `Ihre ${art} ist eingegangen – ${code}`;
      text = `Sehr geehrte Damen und Herren,

vielen Dank für Ihre ${art}. Sie ist bei uns eingegangen und wird bearbeitet.

Betreff: ${betreff}${codeLine}${linkLine}

${gruss}`;
    } else if (kind === 'status') {
      const label = STATUS_LABEL_DE[ticket.status] || ticket.status;
      subject = `Statusupdate zu Ihrer ${art} – ${code}`;
      text = `Sehr geehrte Damen und Herren,

der Status Ihrer ${art} wurde aktualisiert.

Neuer Status: ${label}
Betreff: ${betreff}${codeLine}${linkLine}

${gruss}`;
    } else {
      const msg = (ticket.tenant_message || '').trim();
      if (!msg) return { sent: false, reason: 'no_message' };
      subject = `Neue Nachricht zu Ihrer ${art} – ${code}`;
      text = `Sehr geehrte Damen und Herren,

Sie haben eine neue Nachricht von uns zu Ihrer ${art}:

"${msg}"

Betreff: ${betreff}${codeLine}${linkLine}

${gruss}`;
    }

    return await sendMail({
      to: email,
      subject,
      text,
      replyTo: am?.email ?? null,
      fromName: am?.name ?? null,
    });
  } catch (e: any) {
    console.error('[notifyTenant] Fehler', e);
    return { sent: false, reason: 'exception' };
  }
}
