// app/dashboard/components/StatsOverview.tsx
//
// Admin KPI overview for the dashboard. Reads tickets from Supabase and (for
// the per-AM split) resolves each ticket's Odoo object reference via the same
// enrichment the backoffice list uses.

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getTenancyNamesAction } from '../../backoffice/tickets/actions';
import { isOverdue, assetGroupFromRef, type PriorityLike } from '../../../lib/ticketMetrics';
import { Card, Spinner, cn } from '@/components/ui';

type StatTicket = {
  id: string;
  status: string;
  priority: PriorityLike;
  created_at: string;
  closed_at: string | null;
  beauftragungsumme: number | null;
  odoo_tenancy_id: number | null;
};

export function StatsOverview() {
  const [tickets, setTickets] = useState<StatTicket[] | null>(null);
  const [assetByTenancy, setAssetByTenancy] = useState<Record<number, 'AD' | 'AC' | null>>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('tickets')
        .select('id, status, priority, created_at, closed_at, beauftragungsumme, odoo_tenancy_id')
        .neq('status', 'archived');

      const rows = (data || []) as StatTicket[];
      setTickets(rows);

      const ids = rows
        .map((t) => t.odoo_tenancy_id)
        .filter((x): x is number => !!x && x > 0);

      if (ids.length) {
        const res = await getTenancyNamesAction(ids);
        if (res.success && res.data) {
          const map: Record<number, 'AD' | 'AC' | null> = {};
          const data2 = res.data as Record<string, { property_ref?: string }>;
          for (const [id, info] of Object.entries(data2)) {
            map[Number(id)] = assetGroupFromRef(info.property_ref);
          }
          setAssetByTenancy(map);
        }
      }
    };
    load();
  }, []);

  if (!tickets) {
    return (
      <Card className="flex items-center justify-center p-10">
        <Spinner className="h-6 w-6 text-zinc-400" />
      </Card>
    );
  }

  const open = tickets.filter((t) => t.status !== 'closed');
  const byStatus = {
    new: tickets.filter((t) => t.status === 'new').length,
    open: tickets.filter((t) => t.status === 'open').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    closed: tickets.filter((t) => t.status === 'closed').length,
  };
  const overdue = tickets.filter((t) => isOverdue(t)).length;

  const weekAgo = Date.now() - 7 * 86_400_000;
  const thisWeek = tickets.filter((t) => new Date(t.created_at).getTime() >= weekAgo).length;

  const closed = tickets.filter((t) => t.status === 'closed' && t.closed_at);
  const avgResolution =
    closed.length > 0
      ? Math.round(
          closed.reduce(
            (sum, t) => sum + (new Date(t.closed_at!).getTime() - new Date(t.created_at).getTime()),
            0
          ) /
            closed.length /
            86_400_000
        )
      : null;

  const committed = open.reduce((sum, t) => sum + (t.beauftragungsumme ?? 0), 0);
  const fmtEuro = (n: number) => `${n.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;

  const andrea = open.filter((t) => t.odoo_tenancy_id && assetByTenancy[t.odoo_tenancy_id] === 'AD').length;
  const nadine = open.filter((t) => t.odoo_tenancy_id && assetByTenancy[t.odoo_tenancy_id] === 'AC').length;

  const total = tickets.length || 1;
  const segs = [
    { key: 'new', label: 'Neu', n: byStatus.new, color: 'bg-zinc-400' },
    { key: 'open', label: 'Offen', n: byStatus.open, color: 'bg-blue-400' },
    { key: 'in_progress', label: 'In Bearbeitung', n: byStatus.in_progress, color: 'bg-indigo-500' },
    { key: 'closed', label: 'Geschlossen', n: byStatus.closed, color: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Offen" value={open.length} sub={`Neu ${byStatus.new} · In Bearb. ${byStatus.in_progress}`} />
        <Stat label="Überfällig" value={overdue} tone={overdue > 0 ? 'danger' : 'default'} />
        <Stat label="Diese Woche" value={thisWeek} sub="neu erstellt" />
        <Stat label="Ø Bearbeitung" value={avgResolution !== null ? `${avgResolution} T` : '—'} sub="bis Abschluss" />
        <Stat label="Beauftragt" value={fmtEuro(committed)} sub="laufend" />
        <Stat label="AM-Last" value={`${andrea} / ${nadine}`} sub="Andrea / Nadine" />
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Statusverteilung</h3>
          <span className="text-xs text-zinc-400">{tickets.length} Tickets</span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
          {segs.map((s) =>
            s.n > 0 ? (
              <div
                key={s.key}
                className={cn('h-full', s.color)}
                style={{ width: `${(s.n / total) * 100}%` }}
                title={`${s.label}: ${s.n}`}
              />
            ) : null
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {segs.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className={cn('h-2 w-2 rounded-full', s.color)} />
              {s.label} <span className="font-semibold text-zinc-700">{s.n}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{label}</div>
      <div className={cn('mt-1 text-2xl font-bold', tone === 'danger' ? 'text-red-600' : 'text-zinc-900')}>
        {value}
      </div>
      {sub && <div className="mt-0.5 truncate text-xs text-zinc-400">{sub}</div>}
    </Card>
  );
}
