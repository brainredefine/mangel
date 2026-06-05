// app/tickets/[id]/components/VendorStatusPanel.tsx
//
// Dienstleister-Verfolgung: beauftragt am, Bestätigung, Status, Frist.

'use client';

import { useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { logTicketActivityAction } from '../actions';
import { Card, Button, cn } from '@/components/ui';
import type { TicketWithMeta } from '../types';

type Props = {
  ticket: TicketWithMeta;
  setTicket: React.Dispatch<React.SetStateAction<TicketWithMeta | null>>;
};

type VStatus = 'commissioned' | 'confirmed' | 'completed';

const STEPS: { key: VStatus; label: string }[] = [
  { key: 'commissioned', label: 'Beauftragt' },
  { key: 'confirmed', label: 'Bestätigt' },
  { key: 'completed', label: 'Erledigt' },
];

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}

export function VendorStatusPanel({ ticket, setTicket }: Props) {
  const [saving, setSaving] = useState<string | null>(null);

  const status = (ticket.vendor_status as VStatus | null) ?? null;
  const currentIndex = status ? STEPS.findIndex((s) => s.key === status) : -1;

  const apply = async (patch: Partial<TicketWithMeta>, key: string, activityDetail?: string) => {
    setSaving(key);
    const { error } = await supabase.from('tickets').update(patch).eq('id', ticket.id);
    if (!error) {
      setTicket((prev) => (prev ? ({ ...prev, ...patch } as TicketWithMeta) : prev));
      if (activityDetail) logTicketActivityAction(ticket.id, 'vendor_status', activityDetail).catch(() => {});
    }
    setSaving(null);
  };

  const nowIso = () => new Date().toISOString();

  const markCommissioned = () =>
    apply(
      { vendor_status: 'commissioned', beauftragt_at: ticket.beauftragt_at ?? nowIso() },
      'commissioned',
      'Als beauftragt markiert'
    );
  const markConfirmed = () =>
    apply(
      { vendor_status: 'confirmed', vendor_confirmed_at: ticket.vendor_confirmed_at ?? nowIso() },
      'confirmed',
      'Bestätigung erhalten'
    );
  const markCompleted = () => apply({ vendor_status: 'completed' }, 'completed', 'Als erledigt markiert');
  const reset = () =>
    apply({ vendor_status: null, beauftragt_at: null, vendor_confirmed_at: null }, 'reset', 'Dienstleister-Status zurückgesetzt');

  const due = ticket.expected_enddate ? ticket.expected_enddate.slice(0, 10) : null;
  const overdue = !!due && status !== 'completed' && new Date(due).getTime() < Date.now();

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-900">Dienstleister-Status</h2>
        {status && (
          <button
            onClick={reset}
            disabled={!!saving}
            className="text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-700 disabled:opacity-50"
          >
            Zurücksetzen
          </button>
        )}
      </div>

      {!ticket.chosen_tgm ? (
        <p className="text-sm text-zinc-500">Noch kein Dienstleister ausgewählt.</p>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-2">
            <span className="text-sm text-zinc-500">Dienstleister:</span>
            <span className="font-semibold text-zinc-900">{ticket.chosen_tgm}</span>
          </div>

          {/* Stepper */}
          <div className="mb-5 flex items-center">
            {STEPS.map((s, i) => {
              const done = i <= currentIndex;
              return (
                <div key={s.key} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                        done ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-400'
                      )}
                    >
                      {i < currentIndex ? (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className={cn('mt-1.5 text-xs', done ? 'font-medium text-zinc-900' : 'text-zinc-400')}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn('mx-2 h-0.5 flex-1 rounded-full', i < currentIndex ? 'bg-indigo-600' : 'bg-zinc-100')} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Dates */}
          <div className="mb-5 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-zinc-400">Beauftragt am</div>
              <div className="font-medium text-zinc-900">{formatDate(ticket.beauftragt_at)}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-400">Bestätigt am</div>
              <div className="font-medium text-zinc-900">{formatDate(ticket.vendor_confirmed_at)}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-400">Frist</div>
              <div className={cn('font-medium', overdue ? 'text-red-600' : 'text-zinc-900')}>
                {formatDate(ticket.expected_enddate)}
                {overdue ? ' · überfällig' : ''}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {currentIndex < 0 && (
              <Button onClick={markCommissioned} loading={saving === 'commissioned'} size="sm">
                Als beauftragt markieren
              </Button>
            )}
            {status === 'commissioned' && (
              <Button onClick={markConfirmed} loading={saving === 'confirmed'} size="sm">
                Bestätigung erhalten
              </Button>
            )}
            {status === 'confirmed' && (
              <Button onClick={markCompleted} loading={saving === 'completed'} size="sm">
                Als erledigt markieren
              </Button>
            )}
            {status === 'completed' && (
              <span className="text-sm font-medium text-emerald-600">✓ Abgeschlossen</span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
