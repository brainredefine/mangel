'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Profile = {
  id: string;
  tenant_id: string;
  role: string;
};

type TicketStatus = 'new' | 'open' | 'in_progress' | 'closed';

type Ticket = {
  id: string;
  tenant_id: string;
  created_by: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high';
  status: TicketStatus;
  created_at: string;
};

export default function ExistingTicketsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push('/sign-in');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        console.error(profileError);
        setErrorMsg("Ihr Profil kann nicht geladen werden.");
        setLoading(false);
        return;
      }

      setProfile(profileData);

      // Tickets du tenant uniquement
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('*')
        .eq('tenant_id', profileData.tenant_id)
        .order('created_at', { ascending: false });

      if (ticketsError) {
        console.error(ticketsError);
        setErrorMsg("Fehler beim Laden der Tickets.");
        setLoading(false);
        return;
      }

      setTickets((ticketsData || []) as Ticket[]);
      setLoading(false);
    };

    load();
  }, [router]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const getPriorityLabel = (p: string) => {
    switch (p) {
      case 'high':
        return <span className="text-red-700 font-bold">Hoch</span>;
      case 'low':
        return <span className="text-gray-600">Niedrig</span>;
      default:
        return <span className="text-gray-900">Normal</span>;
    }
  };

  const getStatusLabel = (s: TicketStatus) => {
    switch (s) {
      case 'new':
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">Neu</span>;
      case 'open':
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-50 text-yellow-800 border border-yellow-200">Offen</span>;
      case 'in_progress':
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">In Bearbeitung</span>;
      case 'closed':
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">Geschlossen</span>;
      default:
        return s;
    }
  };

  // Filtrage : pas de closed > 7 jours
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const visibleTickets = tickets.filter((t) => {
    if (t.status !== 'closed') return true;
    const created = new Date(t.created_at);
    return created >= weekAgo;
  });

  if (loading) {
    return (
      <main className="min-h-screen w-full bg-gray-100 flex items-center justify-center p-6 text-gray-900">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-gray-600">Ihre Tickets werden geladen...</p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen w-full bg-gray-100 flex items-center justify-center p-6 text-gray-900">
        <div className="w-full max-w-md bg-white p-6 rounded-xl shadow-sm border border-red-200 text-center space-y-4">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-600 text-xl">
            ⚠️
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Ein Fehler ist aufgetreten</h3>
          <p className="text-sm text-red-600">{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()}
            className="text-sm underline text-gray-600 hover:text-gray-900"
          >
            Seite neu laden
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-gray-100 flex items-start justify-center p-6 text-gray-900">
      <div className="w-full max-w-5xl space-y-6">
        
        {/* En-tête avec bouton de création */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Meine Tickets</h1>
            <p className="text-sm text-gray-600 mt-1">
              Hier finden Sie eine Übersicht Ihrer gemeldeten Mängel.
            </p>
          </div>
          <Link 
            href="/tickets/new"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-gray-800 transition active:scale-95"
          >
            + Neues Ticket
          </Link>
        </div>

        {/* Liste des tickets */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {visibleTickets.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-3xl text-gray-400">
                📭
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Keine aktuellen Tickets</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                  Es liegen keine offenen Meldungen vor. Bereits geschlossene Tickets werden nach einer Woche automatisch archiviert.
                </p>
              </div>
              <div className="pt-2">
                 <Link href="/tickets/new" className="text-sm font-medium text-gray-900 underline hover:text-gray-700">
                   Ein Problem melden?
                 </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-gray-700 w-32">Datum</th>
                    <th className="px-6 py-4 font-semibold text-gray-700">Titel & Beschreibung</th>
                    <th className="px-6 py-4 font-semibold text-gray-700 w-32">Priorität</th>
                    <th className="px-6 py-4 font-semibold text-gray-700 w-40">Status</th>
                    <th className="px-6 py-4 font-semibold text-gray-700 w-20 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleTickets.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-50 transition cursor-pointer group"
                      onClick={() => router.push(`/tickets/${t.id}`)}
                    >
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap align-top">
                        {formatDate(t.created_at)}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="font-semibold text-gray-900 text-base mb-1 group-hover:text-blue-700 transition-colors">
                            {t.title}
                        </div>
                        {t.description && (
                          <div className="text-gray-500 text-xs line-clamp-2 leading-relaxed max-w-xl">
                            {t.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top">
                        {getPriorityLabel(t.priority)}
                      </td>
                      <td className="px-6 py-4 align-top">
                        {getStatusLabel(t.status)}
                      </td>
                      <td className="px-6 py-4 align-middle text-right text-gray-400 group-hover:text-gray-900">
                         →
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <div className="text-center pt-4">
            <p className="text-xs text-gray-400">
                Ältere, geschlossene Tickets werden automatisch ausgeblendet.
            </p>
        </div>

      </div>
    </main>
  );
}