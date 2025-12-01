'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

// --- TYPES ---

type Profile = {
  id: string;
  role: string;
  full_name?: string;
};

type TicketStatus = 'new' | 'open' | 'in_progress' | 'closed';

type Ticket = {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high';
  status: TicketStatus;
  created_at: string;
  tenant_id: string; // On le garde dans l'objet ticket, mais on ne charge plus les infos "Tenant" à côté
  cost_estimated: number | null;
};

export default function BackofficeTicketsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      // 1) Utilisateur connecté
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push('/sign-in');
        return;
      }

      // 2) Profil
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        console.error(profileError);
        setErrorMsg("Profil konnte nicht geladen werden.");
        setLoading(false);
        return;
      }

      const p = profileData as Profile;
      setProfile(p);

      if (p.role !== 'admin_am') {
        setErrorMsg("Zugriff verweigert: Nur für Asset Manager.");
        setLoading(false);
        return;
      }

      // 3) Tickets (Tous sauf closed)
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('*')
        .neq('status', 'closed')
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

  // --- HELPERS ---

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const formatCost = (value: number | null | undefined) => {
    if (value === null || value === undefined) return <span className="text-gray-300">—</span>;
    try {
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
    } catch {
      return `${value} €`;
    }
  };

  const getPriorityLabel = (p: string) => {
    switch (p) {
      case 'high':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-100">Hoch</span>;
      case 'medium':
        return <span className="text-gray-700">Normal</span>;
      case 'low':
        return <span className="text-gray-500">Niedrig</span>;
      default:
        return <span className="text-gray-500">{p}</span>;
    }
  };

  const getStatusLabel = (s: TicketStatus) => {
    switch (s) {
      case 'new':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">Neu</span>;
      case 'open':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">Offen</span>;
      case 'in_progress':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">In Bearbeitung</span>;
      case 'closed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">Geschlossen</span>;
      default:
        return s;
    }
  };

  // --- RENDER ---

  if (loading) {
    return (
      <main className="min-h-screen w-full bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin" />
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen w-full bg-gray-100 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-red-100 max-w-md w-full text-center space-y-6">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-600 text-xl">🚫</div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Zugriff verweigert</h3>
            <p className="text-sm text-gray-500 mt-2">{errorMsg}</p>
          </div>
          <button
            className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
            onClick={() => router.push('/dashboard')}
          >
            Zurück zum Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-gray-100 flex flex-col items-center p-6 text-gray-900">
      
      {/* Header (Même style que Dashboard) */}
      <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
         <div className="text-center md:text-left">
            <h1 className="text-3xl font-semibold text-gray-900">Backoffice Tickets</h1>
            <p className="text-gray-500 text-sm mt-1">
              {profile?.full_name ? `Eingeloggt als ${profile.full_name}` : 'Asset Management Übersicht'}
            </p>
         </div>
         <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors px-4 py-2 rounded-lg hover:bg-gray-200 border border-transparent hover:border-gray-300"
        >
          ← Dashboard
        </button>
      </div>

      <div className="w-full max-w-7xl space-y-6">
        
        {/* Table Card (Style "clean" comme le dashboard) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {tickets.length === 0 ? (
            <div className="p-16 text-center space-y-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-3xl text-gray-400 grayscale">
                🎉
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Alles erledigt</h3>
                <p className="text-sm text-gray-500 mt-1">Keine offenen Tickets im System.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase font-semibold text-gray-500">
                  <tr>
                    <th className="px-6 py-4 w-40">Datum</th>
                    <th className="px-6 py-4">Details</th>
                    <th className="px-6 py-4 w-32">Priorität</th>
                    <th className="px-6 py-4 w-32 text-right">Kosten (Est.)</th>
                    <th className="px-6 py-4 w-40 text-center">Status</th>
                    <th className="px-6 py-4 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tickets.map((t) => (
                    <tr 
                      key={t.id} 
                      className="hover:bg-gray-50 transition group cursor-pointer"
                      onClick={() => router.push(`/tickets/${t.id}`)}
                    >
                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap align-top font-mono text-xs">
                        {formatDate(t.created_at)}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="font-semibold text-gray-900 text-base mb-1 group-hover:text-blue-600 transition-colors">
                          {t.title}
                        </div>
                        {t.description && (
                          <div className="text-gray-500 text-xs line-clamp-1 max-w-md">
                            {t.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top">
                        {getPriorityLabel(t.priority)}
                      </td>
                      <td className="px-6 py-4 align-top text-right font-mono text-gray-700">
                        {formatCost(t.cost_estimated)}
                      </td>
                      <td className="px-6 py-4 align-top text-center">
                        {getStatusLabel(t.status)}
                      </td>
                      <td className="px-6 py-4 align-middle text-right text-gray-300 group-hover:text-gray-900 transition-colors">
                        →
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <div className="text-center pb-6">
          <p className="text-xs text-gray-400">
            Geschlossene Tickets werden standardmäßig ausgeblendet.
          </p>
        </div>

      </div>
    </main>
  );
}