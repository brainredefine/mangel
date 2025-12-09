'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { getTenancyNamesAction } from './actions';

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
  tenant_id: string;
  cost_estimated: number | null;
  pm: string | null;
  
  odoo_tenancy_id: number | null;
  
  display_tenancy_name?: string; 
  display_property_id?: string;
  asset_name?: string; 
};

export default function BackofficeTicketsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      // 1) Auth & Profil
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.push('/sign-in'); return; }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        setErrorMsg("Profil konnte nicht geladen werden.");
        setLoading(false);
        return;
      }
      setProfile(profileData as Profile);
      if (profileData.role !== 'admin_am') {
        setErrorMsg("Zugriff verweigert: Nur für Asset Manager.");
        setLoading(false);
        return;
      }

      // 2) Tickets
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('*') 
        .neq('status', 'closed')
        .order('created_at', { ascending: false });

      if (ticketsError) {
        setErrorMsg("Fehler beim Laden der Tickets.");
        setLoading(false);
        return;
      }

      const rawTickets = (ticketsData || []) as Ticket[];
      setTickets(rawTickets);
      setLoading(false);

      // 3) Enrichissement Odoo
      const idsToFetch = rawTickets
        .map(t => t.odoo_tenancy_id)
        .filter((id): id is number => id !== null && id > 0);

      if (idsToFetch.length > 0) {
        const res = await getTenancyNamesAction(idsToFetch);
        if (res.success && res.data) {
          const map = res.data;
          setTickets(currentTickets => 
            currentTickets.map(t => {
              if (t.odoo_tenancy_id && map[t.odoo_tenancy_id]) {
                return {
                  ...t,
                  display_tenancy_name: map[t.odoo_tenancy_id].name,
                  display_property_id: map[t.odoo_tenancy_id].property_id
                };
              }
              return t;
            })
          );
        }
      }
    };

    load();
  }, [router]);

  // --- ACTIONS ---
  const handleClaim = async (e: React.MouseEvent, ticketId: string) => {
    e.stopPropagation();
    if (!profile?.full_name) {
        alert("Profil ohne Namen.");
        return;
    }
    setClaimingId(ticketId);
    
    const { error } = await supabase
        .from('tickets')
        .update({ pm: profile.full_name })
        .eq('id', ticketId);

    if (!error) {
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, pm: profile.full_name || 'Moi' } : t));
    }
    setClaimingId(null);
  };

  // --- HELPERS ---
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('de-DE');
  const formatCost = (value: number | null | undefined) => value ? `${value} €` : '—';
  
  const getPriorityLabel = (p: string) => {
    if(p==='high') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-100">Hoch</span>;
    if(p==='medium') return <span className="text-gray-700 text-xs">Normal</span>;
    return <span className="text-gray-500 text-xs">Niedrig</span>;
  };
  
  const getStatusLabel = (s: TicketStatus) => {
    switch (s) {
      case 'new': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">Neu</span>;
      case 'open': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">Offen</span>;
      case 'in_progress': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">In Bearbeitung</span>;
      case 'closed': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">Geschlossen</span>;
      default: return <span>{s}</span>;
    }
  };

  // --- RENDER ---
  if (loading) return (
    <main className="min-h-screen w-full bg-gray-100 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin" />
    </main>
  );

  if (errorMsg) return (
    <main className="min-h-screen w-full bg-gray-100 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-red-100 max-w-md w-full text-center">
            <p className="text-red-600 font-medium">{errorMsg}</p>
            <button onClick={() => router.push('/dashboard')} className="mt-4 text-sm underline">Dashboard</button>
        </div>
    </main>
  );

  return (
    <main className="min-h-screen w-full bg-gray-100 flex flex-col items-center p-6 text-gray-900">
      
      {/* Header */}
      <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
         <div className="text-center md:text-left">
            <h1 className="text-3xl font-semibold text-gray-900">Backoffice Tickets</h1>
            <p className="text-gray-500 text-sm mt-1">
              {profile?.full_name ? `Eingeloggt als ${profile.full_name}` : 'Asset Management Übersicht'}
            </p>
         </div>
         <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors px-4 py-2 rounded-lg hover:bg-gray-200 border border-transparent hover:border-gray-300">
          ← Dashboard
        </button>
      </div>

      <div className="w-full max-w-7xl space-y-6">
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {tickets.length === 0 ? (
            <div className="p-16 text-center space-y-4">
              <div className="text-3xl grayscale">🎉</div>
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
                    <th className="px-6 py-4 w-32">Datum</th>
                    <th className="px-6 py-4 w-48">Mieter</th>
                    <th className="px-6 py-4">Ticket</th>
                    <th className="px-6 py-4 w-32">Priorität</th>
                    <th className="px-6 py-4 w-44">Verantwortlich (PM)</th> {/* Un peu plus large */}
                    <th className="px-6 py-4 w-32 text-right">Kosten</th>
                    <th className="px-6 py-4 w-32 text-center">Status</th>
                    <th className="px-6 py-4 w-10"></th>
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
                        <span className="font-medium text-gray-900 block">
                            {t.display_tenancy_name 
                              ? t.display_tenancy_name 
                              : (t.odoo_tenancy_id ? `Tenancy #${t.odoo_tenancy_id}` : 'N/A')
                            }
                        </span>
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

                      {/* --- COLONNE PM (MODIFIÉE) --- */}
                      <td className="px-6 py-4 align-top">
                        {t.pm ? (
                            <div className="flex flex-col items-start gap-1">
                                {/* Le PM actuel */}
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold">
                                        {t.pm.charAt(0)}
                                    </div>
                                    <span className="text-sm text-gray-700 truncate max-w-[120px]" title={t.pm}>
                                        {t.pm}
                                    </span>
                                </div>
                                
                                {/* Bouton OVERRIDE visible en bleu */}
                                {t.pm !== profile?.full_name && (
                                    <button
                                        onClick={(e) => handleClaim(e, t.id)}
                                        disabled={claimingId === t.id}
                                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 transition-colors mt-1"
                                    >
                                        {claimingId === t.id ? (
                                            <span className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full"></span>
                                        ) : (
                                            <span>↳ Übernehmen</span>
                                        )}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={(e) => handleClaim(e, t.id)}
                                disabled={claimingId === t.id}
                                className="text-xs border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 text-gray-700 px-3 py-1.5 rounded-md shadow-sm transition flex items-center gap-1.5"
                            >
                                {claimingId === t.id ? (
                                    <span className="animate-spin h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full"></span>
                                ) : (
                                    <span>🙋‍♂️</span>
                                )}
                                Übernehmen
                            </button>
                        )}
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