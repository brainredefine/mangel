// /app/tickets/track/actions.ts
//
// Public ticket tracking. A tenant enters their secret tracking code and gets a
// read-only status view. We deliberately return only tenant-safe fields — no
// cost analysis, vendor data, or admin notes ever leave this action.

'use server';

import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { rateLimit, getClientIp } from '../../../lib/rateLimit';

export type TrackedAttachment = { name: string; url: string; isImage: boolean };

export type TrackedTicket = {
  trackingCode: string;
  ticketType: 'defect' | 'request' | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  createdAt: string;
  closedAt: string | null;
  buildingSection: string | null;
  locationDescription: string | null;
  message: string | null;
  attachments: TrackedAttachment[];
};

export type TrackResult =
  | { success: true; ticket: TrackedTicket }
  | { success: false; error: string };

function normalizeCode(input: string): string {
  let code = (input || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code) return '';
  if (!code.startsWith('MNG-')) {
    code = code.startsWith('MNG') ? `MNG-${code.slice(3)}` : `MNG-${code}`;
  }
  return code;
}

export async function getTicketStatusAction(rawCode: string): Promise<TrackResult> {
  const ip = await getClientIp();
  if (!rateLimit(`track:${ip}`, 30, 60_000).ok) {
    return { success: false, error: 'Zu viele Anfragen. Bitte versuchen Sie es in einer Minute erneut.' };
  }

  const code = normalizeCode(rawCode);
  if (!code || code.length < 6) {
    return { success: false, error: 'Bitte geben Sie einen gültigen Tracking-Code ein.' };
  }

  const { data: ticket, error } = await supabaseAdmin
    .from('tickets')
    .select(
      'id, tracking_code, ticket_type, title, description, status, priority, created_at, closed_at, building_section, location_description, tenant_message'
    )
    .eq('tracking_code', code)
    .single();

  if (error || !ticket) {
    return { success: false, error: 'Kein Ticket mit diesem Code gefunden.' };
  }

  // Tenant-visible files = anything marked 'public'. A tenant's own uploads
  // default to 'public'; staff can additionally mark internal files 'public'
  // to share them (photos or documents). 'private' files stay internal.
  const { data: rawAttachments } = await supabaseAdmin
    .from('ticket_attachments')
    .select('file_path, original_name, mime_type, privacy')
    .eq('ticket_id', ticket.id)
    .eq('privacy', 'public');

  const attachments: TrackedAttachment[] = [];
  for (const att of rawAttachments || []) {
    const { data: signed } = await supabaseAdmin.storage
      .from('ticket_attachments')
      .createSignedUrl(att.file_path, 60 * 60); // 1 hour
    if (signed?.signedUrl) {
      attachments.push({
        name: att.original_name || 'Datei',
        url: signed.signedUrl,
        isImage: !!att.mime_type && att.mime_type.startsWith('image/'),
      });
    }
  }

  return {
    success: true,
    ticket: {
      trackingCode: ticket.tracking_code as string,
      ticketType: (ticket.ticket_type as 'defect' | 'request' | null) ?? null,
      title: ticket.title as string,
      description: (ticket.description as string | null) ?? null,
      status: ticket.status as string,
      priority: ticket.priority as string,
      createdAt: ticket.created_at as string,
      closedAt: (ticket.closed_at as string | null) ?? null,
      buildingSection: (ticket.building_section as string | null) ?? null,
      locationDescription: (ticket.location_description as string | null) ?? null,
      message: (ticket.tenant_message as string | null) ?? null,
      attachments,
    },
  };
}
