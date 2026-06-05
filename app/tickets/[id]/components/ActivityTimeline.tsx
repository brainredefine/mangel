// app/tickets/[id]/components/ActivityTimeline.tsx

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { Card, Spinner, cn } from '@/components/ui';

type Activity = {
  id: string;
  type: string;
  detail: string | null;
  actor_name: string | null;
  created_at: string;
};

const TYPE_META: Record<string, { label: string; dot: string }> = {
  created: { label: 'Erstellt', dot: 'bg-zinc-400' },
  status: { label: 'Status', dot: 'bg-blue-500' },
  vendor_status: { label: 'Dienstleister', dot: 'bg-indigo-500' },
  beauftragung: { label: 'Beauftragung', dot: 'bg-indigo-500' },
  message: { label: 'Nachricht', dot: 'bg-emerald-500' },
  note: { label: 'Notiz', dot: 'bg-zinc-400' },
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs} Std.`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `vor ${days} Tg.`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fullDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE');
  } catch {
    return iso;
  }
}

export function ActivityTimeline({ ticketId }: { ticketId: string }) {
  const [items, setItems] = useState<Activity[] | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('ticket_activity')
      .select('id, type, detail, actor_name, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (active) setItems((data || []) as Activity[]);
      });
    return () => {
      active = false;
    };
  }, [ticketId]);

  return (
    <Card className="p-6">
      <h2 className="mb-5 text-xs font-bold uppercase tracking-[0.1em] text-zinc-900">Verlauf</h2>

      {items === null ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-5 w-5 text-zinc-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">Noch keine Aktivität.</p>
      ) : (
        <ol className="relative space-y-5 border-l border-zinc-200 pl-5">
          {items.map((a) => {
            const meta = TYPE_META[a.type] || { label: a.type, dot: 'bg-zinc-400' };
            return (
              <li key={a.id} className="relative">
                <span className={cn('absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white', meta.dot)} />
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-zinc-900">{meta.label}</span>
                  <span className="text-xs text-zinc-400" title={fullDate(a.created_at)}>
                    {relTime(a.created_at)}
                  </span>
                </div>
                {a.detail && <p className="mt-0.5 text-sm text-zinc-600">{a.detail}</p>}
                {a.actor_name && <p className="mt-0.5 text-xs text-zinc-400">{a.actor_name}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
