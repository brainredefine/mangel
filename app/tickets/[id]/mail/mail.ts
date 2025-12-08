// app/tickets/[id]/mail/mail.ts

import { supabase } from '../../../../lib/supabaseClient';
import type { AttachmentWithUrl } from '../types';

export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 jours

export function formatAddress(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function addDaysIsoDate(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  // YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

export async function buildSignedPhotoLinksText(
  attachments: AttachmentWithUrl[],
  opts?: { excludePrivate?: boolean }
) {
  const excludePrivate = opts?.excludePrivate ?? true;

  const filtered = attachments.filter((att) => {
    const privacy = (att as any).privacy;
    return excludePrivate ? privacy !== 'private' : true;
  });

  if (filtered.length === 0) return '(Keine Fotos verfügbar)';

  const lines = await Promise.all(
    filtered.map(async (att) => {
      const { data, error } = await supabase.storage
        .from('ticket_attachments')
        .createSignedUrl(att.file_path, SIGNED_URL_TTL_SECONDS);

      if (error || !data?.signedUrl) return null;
      return `- ${att.original_name}: ${data.signedUrl}`;
    })
  );

  const ok = lines.filter(Boolean).join('\n\n');
  return ok || '(Keine Fotos verfügbar)';
}

export function buildMailtoHref(params: {
  to: string;
  subject: string;
  body: string;
}) {
  const subject = encodeURIComponent(params.subject);
  const body = encodeURIComponent(params.body);
  const to = params.to ?? '';
  return `mailto:${to}?subject=${subject}&body=${body}`;
}
