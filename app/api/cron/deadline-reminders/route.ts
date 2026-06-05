// app/api/cron/deadline-reminders/route.ts
//
// Sammel-Erinnerung an die Asset Manager für fällige/überfällige Maßnahmen.
// Per Cron aufrufen (täglich). Geschützt über CRON_SECRET — ohne korrektes
// Secret 401. Sendet nur, wenn NOTIFICATIONS_ENABLED === 'true'.

import { NextResponse } from 'next/server';
import { runDeadlineReminders } from '../../../../lib/deadlineReminders';

export const runtime = 'nodejs';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // nicht konfiguriert → gesperrt
  const auth = req.headers.get('authorization') || '';
  const q = new URL(req.url).searchParams.get('secret');
  return auth === `Bearer ${secret}` || q === secret;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  try {
    const result = await runDeadlineReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error('[deadline-reminders] error', e);
    return NextResponse.json({ error: 'Fehler', details: e?.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
