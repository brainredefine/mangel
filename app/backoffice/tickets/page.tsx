// /app/backoffice/tickets/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { getTenancyNamesAction, getPartnerNamesAction } from './actions';
import { ageInDays, isOverdue, assetGroupFromRef } from '../../../lib/ticketMetrics';
import {
  Badge,
  Button,
  Card,
  Spinner,
  StatusBadge,
  priorityMeta,
  cn,
} from '@/components/ui';

// --- TYPES ---

type Profile = {
  id: string;
  role: string;
  full_name?: string;
};

type Ticket = {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'new' | 'open' | 'in_progress' | 'closed' | 'archived';
  created_at: string;
  tenant_id: string;
  cost_estimated: number | null;
  pm: string | null;
  odoo_tenancy_id: number | null;
  tracking_code: string | null;
  contact_name: string | null;
  ticket_type?: 'defect' | 'request';
  display_tenancy_name?: string;
  display_property_id?: string;
  display_property_ref?: string;
  display_property_city?: string;
  display_tenant_name?: string;
};

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'new', label: 'Neu' },
  { key: 'open', label: 'Offen' },
  { key: 'in_progress', label: 'In Bearbeitung' },
  { key: 'closed', label: 'Geschlossen' },
];

export default function BackofficeTicketsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [personFilter, setPersonFilter] = useState<'all' | 'andrea' | 'nadine'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.push('/auth'); return; }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        setErrorMsg('Profil konnte nicht geladen werden.');
        setLoading(false);
        return;
      }

      setProfile(profileData as Profile);

      if (profileData.role !== 'admin_am') {
        setErrorMsg('Zugriff verweigert: Nur für Asset Manager.');
        setLoading(false);
        return;
      }

      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('*')
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (ticketsError) {
        setErrorMsg('Fehler beim Laden der Tickets.');
        setLoading(false);
        return;
      }

      const rawTickets = (ticketsData || []) as Ticket[];
      setTickets(rawTickets);
      setLoading(false);

      // Enrichissement Odoo - Tenancy names
      const tenancyIdsToFetch = rawTickets
        .map((t) => t.odoo_tenancy_id)
        .filter((id): id is number => id !== null && id > 0);

      if (tenancyIdsToFetch.length > 0) {
        const res = await getTenancyNamesAction(tenancyIdsToFetch);
        if (res.success && res.data) {
          const map = res.data;
          setTickets((currentTickets) =>
            currentTickets.map((t) => {
              if (t.odoo_tenancy_id && map[t.odoo_tenancy_id]) {
                return {
                  ...t,
                  display_tenancy_name: map[t.odoo_tenancy_id].name,
                  display_property_id: map[t.odoo_tenancy_id].property_id,
                  display_property_ref: map[t.odoo_tenancy_id].property_ref,
                  display_property_city: map[t.odoo_tenancy_id].property_city,
                };
              }
              return t;
            })
          );
        }
      }

      // Enrichissement Odoo - Partner names (tenant_id = res.partner.id)
      const partnerIdsToFetch = rawTickets
        .map((t) => Number(t.tenant_id))
        .filter((id): id is number => !isNaN(id) && id > 0);

      if (partnerIdsToFetch.length > 0) {
        const res = await getPartnerNamesAction(partnerIdsToFetch);
        if (res.success && res.data) {
          const map = res.data;
          setTickets((currentTickets) =>
            currentTickets.map((t) => {
              const partnerId = Number(t.tenant_id);
              if (partnerId && map[partnerId]) {
                return { ...t, display_tenant_name: map[partnerId] };
              }
              return t;
            })
          );
        }
      }
    };

    load();
  }, [router]);

  // --- HELPERS ---
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const formatCost = (value: number | null | undefined) =>
    value ? `${value.toLocaleString('de-DE')} €` : '—';

  // Asset-Manager-Zuordnung & SLA kommen aus lib/ticketMetrics (eine Quelle der Wahrheit).
  const assetGroup = (t: Ticket) => assetGroupFromRef(t.display_property_ref);
  const relativeAge = (iso: string) => {
    const d = ageInDays(iso);
    if (d <= 0) return 'heute';
    if (d === 1) return 'gestern';
    return `vor ${d} Tagen`;
  };

  // --- FILTERING ---
  let filteredTickets = tickets;

  if (statusFilter === 'all') {
    filteredTickets = filteredTickets.filter((t) => t.status !== 'closed');
  } else {
    filteredTickets = filteredTickets.filter((t) => t.status === statusFilter);
  }

  if (personFilter === 'andrea') {
    filteredTickets = filteredTickets.filter((t) => assetGroup(t) === 'AD');
  } else if (personFilter === 'nadine') {
    filteredTickets = filteredTickets.filter((t) => assetGroup(t) === 'AC');
  }

  const q = search.trim().toLowerCase();
  if (q) {
    filteredTickets = filteredTickets.filter((t) =>
      [
        t.title,
        t.tracking_code,
        t.display_tenant_name,
        t.contact_name,
        t.display_property_ref,
        t.display_property_city,
        t.display_tenancy_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }

  filteredTickets = [...filteredTickets].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Counts
  const counts: Record<string, number> = {
    all: tickets.filter((t) => t.status !== 'closed').length,
    new: tickets.filter((t) => t.status === 'new').length,
    open: tickets.filter((t) => t.status === 'open').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    closed: tickets.filter((t) => t.status === 'closed').length,
    andrea: tickets.filter((t) => assetGroup(t) === 'AD' && t.status !== 'closed').length,
    nadine: tickets.filter((t) => assetGroup(t) === 'AC' && t.status !== 'closed').length,
    overdue: tickets.filter((t) => isOverdue(t)).length,
  };

  // --- RENDER ---
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        <Spinner className="h-8 w-8 text-zinc-400" />
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
        <Card className="max-w-sm p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="font-medium text-zinc-900">{errorMsg}</p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.push('/dashboard')}>
            ← Dashboard
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">Backoffice</h1>
              <p className="text-xs text-zinc-500">{profile?.full_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {counts.overdue > 0 && (
              <Badge className="bg-red-50 text-red-600 ring-1 ring-red-200">
                {counts.overdue} überfällig
              </Badge>
            )}
            <Badge className="bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200">
              {counts.all} offen
            </Badge>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl space-y-3 px-6 py-3">
          {/* Suche */}
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen: Mieter, Adresse, Objekt-Code, Titel, MNG-Code…"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-10 pr-9 text-sm text-zinc-900 transition-all placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                title="Leeren"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter-Leiste */}
          <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 overflow-x-auto">
            {STATUS_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  statusFilter === key
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                )}
              >
                {label}
                <span className={cn('text-xs', statusFilter === key ? 'text-white/60' : 'text-zinc-400')}>
                  {counts[key] || 0}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Asset-Manager-Filter: Andrea = AD-Objekte, Nadine = AC-Objekte */}
            <button
              onClick={() => setPersonFilter(personFilter === 'andrea' ? 'all' : 'andrea')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                personFilter === 'andrea'
                  ? 'bg-emerald-600 text-white'
                  : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', personFilter === 'andrea' ? 'bg-white' : 'bg-emerald-500')} />
              Andrea
              <span className={cn('text-xs', personFilter === 'andrea' ? 'text-white/70' : 'text-zinc-400')}>
                {counts.andrea}
              </span>
            </button>
            <button
              onClick={() => setPersonFilter(personFilter === 'nadine' ? 'all' : 'nadine')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                personFilter === 'nadine'
                  ? 'bg-amber-600 text-white'
                  : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', personFilter === 'nadine' ? 'bg-white' : 'bg-amber-500')} />
              Nadine
              <span className={cn('text-xs', personFilter === 'nadine' ? 'text-white/70' : 'text-zinc-400')}>
                {counts.nadine}
              </span>
            </button>

          </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {filteredTickets.length === 0 ? (
          <Card className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
              <svg className="h-6 w-6 text-zinc-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-zinc-500">Keine Tickets gefunden.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-zinc-100 overflow-hidden p-0">
            {filteredTickets.map((t) => {
              const prio = priorityMeta(t.priority);
              return (
                <div
                  key={t.id}
                  onClick={() => router.push(`/tickets/${t.id}`)}
                  className="group flex cursor-pointer items-center gap-3 px-5 py-2 transition-colors hover:bg-zinc-50"
                >
                  {/* Priority accent */}
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', prio.dot)} title={prio.label} />

                  {/* Status */}
                  <div className="w-28 shrink-0">
                    <StatusBadge status={t.status} />
                  </div>

                  {/* Alter / SLA */}
                  <div
                    className={cn(
                      'hidden w-24 shrink-0 text-xs lg:block',
                      isOverdue(t) ? 'font-semibold text-red-600' : 'text-zinc-400'
                    )}
                    title={formatDate(t.created_at)}
                  >
                    {relativeAge(t.created_at)}
                  </div>

                  {/* Tenant + Objekt (Code · Stadt) */}
                  <div className="hidden min-w-0 flex-1 sm:block">
                    <div className="truncate text-sm font-medium text-zinc-900">
                      {t.display_tenant_name || t.contact_name || '—'}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {(t.display_property_ref || '').trim() && (
                        <span
                          className={cn(
                            'shrink-0 rounded px-1.5 py-px font-mono text-[10px] font-semibold',
                            assetGroup(t) === 'AD'
                              ? 'bg-emerald-50 text-emerald-700'
                              : assetGroup(t) === 'AC'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-zinc-100 text-zinc-500'
                          )}
                        >
                          {(t.display_property_ref || '').trim()}
                        </span>
                      )}
                      <span className="truncate text-xs text-zinc-500">
                        {t.display_property_city ||
                          t.display_tenancy_name ||
                          (t.odoo_tenancy_id ? `#${t.odoo_tenancy_id}` : '')}
                      </span>
                    </div>
                  </div>

                  {/* Title + meta */}
                  <div className="min-w-0 flex-1">
                    <h3
                      className="truncate text-sm font-medium text-zinc-900 group-hover:text-indigo-600"
                      title={t.title}
                    >
                      {t.title}
                    </h3>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400">
                      <span>{t.ticket_type === 'request' ? 'Anfrage' : 'Mangel'}</span>
                      {t.tracking_code && <span className="truncate font-mono">{t.tracking_code}</span>}
                      {isOverdue(t) && (
                        <span className="shrink-0 rounded bg-red-50 px-1.5 py-px text-[10px] font-semibold text-red-600">
                          Überfällig
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cost */}
                  <div className="hidden w-20 shrink-0 text-right font-mono text-xs text-zinc-500 sm:block">
                    {formatCost(t.cost_estimated)}
                  </div>

                  {/* Arrow */}
                  <svg
                    className="h-4 w-4 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              );
            })}
          </Card>
        )}

        <p className="mt-5 text-center text-xs text-zinc-400">
          Archivierte Tickets werden ausgeblendet.
        </p>
      </div>
    </main>
  );
}
