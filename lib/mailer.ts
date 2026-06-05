// lib/mailer.ts
//
// Low-level Resend sender with the global send guard — SERVER ONLY.
// Nothing is sent unless NOTIFICATIONS_ENABLED === 'true'. While disabled
// (the default), the intended mail is only logged. NOTIFICATIONS_TEST_EMAIL
// redirects every mail to a single test inbox (subject prefixed with the real
// recipient). Shared by tenant notifications and internal reminders.

function parseFromAddress(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim();
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string | null;
  fromName?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const { to, subject, text } = opts;
  const enabled = process.env.NOTIFICATIONS_ENABLED === 'true';
  const testEmail = (process.env.NOTIFICATIONS_TEST_EMAIL || '').trim() || null;
  const key = process.env.RESEND;
  const fromRaw = process.env.RESEND_FROM || 'Mangelmanagement <mangel@redefine-group.com>';
  const from = opts.fromName ? `${opts.fromName} <${parseFromAddress(fromRaw)}>` : fromRaw;

  if (!enabled) {
    console.log(`[mailer] DEAKTIVIERT — würde senden an ${to}: "${subject}"`);
    return { sent: false, reason: 'disabled' };
  }
  if (!key) {
    console.warn('[mailer] RESEND-Key fehlt — übersprungen');
    return { sent: false, reason: 'no_resend_key' };
  }

  const realTo = testEmail || to;
  if (!realTo) return { sent: false, reason: 'no_recipient' };
  const finalSubject = testEmail ? `[TEST→${to}] ${subject}` : subject;

  const payload: Record<string, any> = { from, to: [realTo], subject: finalSubject, text };
  if (opts.replyTo) payload.reply_to = opts.replyTo;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[mailer] Resend-Fehler', res.status, await res.text());
      return { sent: false, reason: `resend_${res.status}` };
    }
    return { sent: true };
  } catch (e: any) {
    console.error('[mailer] Versand fehlgeschlagen', e);
    return { sent: false, reason: 'exception' };
  }
}
