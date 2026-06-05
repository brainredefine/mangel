// /app/dashboard/page.tsx

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { MyProfileCard } from './components/MyProfileCard';
import { StatsOverview } from './components/StatsOverview';
import { Spinner } from '@/components/ui';

type Profile = {
  id: string;
  role: string;
  full_name?: string;
  odoo_id?: number | null;
};

export default function DashboardPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // --- CHARGEMENT DU PROFIL ---
  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, odoo_id')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Erreur chargement profil:', error);
      } else {
        setProfile(data as Profile);
      }
      setLoading(false);
    };

    loadProfile();
  }, [router]);

  // --- LOGOUT ---
  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.refresh();
    router.push('/auth');
  };

  const isAdminAm = profile?.role === 'admin_am';

  // --- RENDER: Loading ---
  if (loading) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-zinc-50">
        <Spinner className="h-8 w-8 text-zinc-400" />
      </main>
    );
  }

  // --- RENDER: Main ---
  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-zinc-50 p-6 text-zinc-900">

      {/* Header */}
      <div className="mb-10 flex w-full max-w-5xl items-center justify-between">
        <div className="text-sm text-zinc-500">
          {profile?.full_name ? `Hallo, ${profile.full_name}` : 'Willkommen'}
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          {isLoggingOut ? '...' : 'Abmelden'}
        </button>
      </div>

      {/* Content */}
      <div className="flex w-full max-w-5xl flex-col pb-12">

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isAdminAm ? 'Überblick über alle Tickets' : 'Was möchten Sie tun?'}
          </p>
        </div>

        {/* KPIs (Admin) */}
        {isAdminAm && (
          <div className="mb-10">
            <StatsOverview />
          </div>
        )}

        {/* Schnellzugriff */}
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-400">
          Schnellzugriff
        </h2>

        {/* Actions Grid */}
        <div className="grid gap-4 md:grid-cols-2">

          {/* Card: Backoffice (Admin only) - DARK */}
          {isAdminAm && (
            <Link
              href="/backoffice/tickets"
              className="group block rounded-2xl bg-zinc-900 p-6 shadow-sm transition-all hover:bg-zinc-800"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white transition-colors group-hover:bg-indigo-500/20 group-hover:text-indigo-300">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
              </div>
              <h2 className="mb-1 text-lg font-semibold text-white">
                AM/PM Backoffice
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-zinc-400">
                Tickets verwalten, Status ändern, Dienstleister beauftragen.
              </p>
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-400 transition-all group-hover:gap-3">
                Öffnen
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                </svg>
              </div>
            </Link>
          )}

          {/* Card 4: Ticket für Mieter (Admin only) - DARK */}
          {isAdminAm && (
            <Link
              href="/tickets/new-admin"
              className="group block rounded-2xl bg-zinc-900 p-6 shadow-sm transition-all hover:bg-zinc-800"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white transition-colors group-hover:bg-indigo-500/20 group-hover:text-indigo-300">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <h2 className="mb-1 text-lg font-semibold text-white">
                Ticket für Mieter
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-zinc-400">
                Ticket im Namen eines Tenants erstellen.
              </p>
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-400 transition-all group-hover:gap-3">
                Erstellen
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                </svg>
              </div>
            </Link>
          )}
        </div>

        {/* Profile Card - Anyone with odoo_id */}
        {profile?.odoo_id && (
          <div className="mt-8">
            <MyProfileCard partnerId={profile.odoo_id} />
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 border-t border-zinc-200 pt-6 text-center">
          <p className="text-xs text-zinc-400">
            © Mangelmanagement System
          </p>
        </div>
      </div>
    </main>
  );
}