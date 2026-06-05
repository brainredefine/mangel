// /app/tickets/track/page.tsx — public ticket tracking (no account).

'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { getTicketStatusAction, type TrackedTicket } from './actions';
import { Button, Card, Input, StatusBadge, cn } from '../../../components/ui';

const STEPS = ['Eingegangen', 'Angenommen', 'In Bearbeitung', 'Abgeschlossen'] as const;

function stepIndex(status: string): number {
  if (status === 'closed' || status === 'archived') return 3;
  if (status === 'in_progress') return 2;
  if (status === 'open') return 1;
  return 0; // new
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function TrackPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TrackedTicket | null>(null);

  const lookup = async (raw: string) => {
    const c = raw.trim();
    if (!c) return;
    setLoading(true);
    setError(null);
    setTicket(null);

    const res = await getTicketStatusAction(c);
    if (res.success) {
      setTicket(res.ticket);
    } else {
      setError(res.error);
    }
    setLoading(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    lookup(code);
  };

  // Über den E-Mail-Link (…/tickets/track?code=MNG-…) direkt vorausfüllen & laden.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('code');
    if (c) {
      setCode(c.toUpperCase());
      lookup(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top bar */}
      <header className="border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Startseite
          </Link>
          <Link href="/tickets/new" className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700">
            Neues Ticket
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Ticket verfolgen</h1>
          <p className="mt-2 text-zinc-500">
            Geben Sie den Tracking-Code ein, den Sie bei der Erstellung erhalten haben.
          </p>
        </div>

        {/* Search */}
        <Card className="p-2">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="MNG-XXXXXXXX"
              className="font-mono tracking-wider sm:flex-1"
              autoFocus
            />
            <Button type="submit" loading={loading} className="sm:w-auto">
              Verfolgen
            </Button>
          </form>
        </Card>

        {error && (
          <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            {error}
          </div>
        )}

        {/* Result */}
        {ticket && (
          <Card className="mt-6 overflow-hidden">
            <div className="border-b border-zinc-100 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    {ticket.ticketType === 'request' ? 'Anfrage' : 'Mangelmeldung'}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-zinc-900">{ticket.title}</h2>
                  <p className="mt-1 font-mono text-sm text-zinc-400">{ticket.trackingCode}</p>
                </div>
                <StatusBadge status={ticket.status} />
              </div>
            </div>

            {/* Stepper */}
            <div className="border-b border-zinc-100 p-6">
              <div className="flex items-center">
                {STEPS.map((label, i) => {
                  const current = stepIndex(ticket.status);
                  const done = i <= current;
                  return (
                    <div key={label} className="flex flex-1 items-center last:flex-none">
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                            done ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-400'
                          )}
                        >
                          {i < current ? (
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          ) : (
                            i + 1
                          )}
                        </div>
                        <span className={cn('mt-2 text-center text-xs', done ? 'font-medium text-zinc-900' : 'text-zinc-400')}>
                          {label}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={cn('mx-2 h-0.5 flex-1 rounded-full', i < current ? 'bg-zinc-900' : 'bg-zinc-100')} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Message from the team (admin-written, tenant-visible) */}
            {ticket.message && (
              <div className="border-b border-zinc-100 bg-indigo-50/40 p-6">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                  </svg>
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Nachricht vom Team</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{ticket.message}</p>
              </div>
            )}

            {/* Details */}
            <div className="space-y-4 p-6">
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div>
                  <span className="text-zinc-400">Erstellt am</span>
                  <p className="font-medium text-zinc-900">{formatDate(ticket.createdAt)}</p>
                </div>
                {ticket.closedAt && (
                  <div>
                    <span className="text-zinc-400">Abgeschlossen am</span>
                    <p className="font-medium text-zinc-900">{formatDate(ticket.closedAt)}</p>
                  </div>
                )}
                {ticket.buildingSection && (
                  <div>
                    <span className="text-zinc-400">Bereich</span>
                    <p className="font-medium text-zinc-900">{ticket.buildingSection}</p>
                  </div>
                )}
              </div>

              {ticket.description && (
                <div>
                  <span className="text-sm text-zinc-400">Beschreibung</span>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{ticket.description}</p>
                </div>
              )}

              {ticket.attachments.some((a) => a.isImage) && (
                <div>
                  <span className="text-sm text-zinc-400">Fotos</span>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {ticket.attachments.filter((a) => a.isImage).map((a, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="group block overflow-hidden rounded-lg border border-zinc-200">
                        <img src={a.url} alt={a.name} className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {ticket.attachments.some((a) => !a.isImage) && (
                <div>
                  <span className="text-sm text-zinc-400">Dokumente</span>
                  <div className="mt-2 space-y-2">
                    {ticket.attachments.filter((a) => !a.isImage).map((a, i) => (
                      <a
                        key={i}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm transition-colors hover:border-indigo-300 hover:bg-zinc-50"
                      >
                        <svg className="h-5 w-5 flex-shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        <span className="min-w-0 flex-1 truncate font-medium text-zinc-700">{a.name}</span>
                        <svg className="h-4 w-4 flex-shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
