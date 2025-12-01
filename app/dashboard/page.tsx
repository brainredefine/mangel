'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type Profile = {
  id: string;
  role: string; // 'tenant_user' | 'admin_am'
  full_name?: string;
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
        router.push('/sign-in');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name')
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
    router.push('/sign-in');
  };

  const isAdminAm = profile?.role === 'admin_am';

  // --- RENDER ---
  if (loading) {
    return (
      <main className="min-h-screen w-full bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-gray-100 flex flex-col items-center p-6 text-gray-900 relative">
      
      {/* Header (Nom + Logout) 
          CORRECTION ICI : ajout de 'relative z-10' pour que le header reste 
          cliquable au-dessus du contenu qui a une marge négative. 
      */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-8 md:mb-12 relative z-10">
         <div className="text-sm font-medium text-gray-500">
            {profile?.full_name ? `Hallo, ${profile.full_name}` : 'Willkommen'}
         </div>
         <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="text-sm text-gray-500 hover:text-red-600 font-medium transition-colors px-3 py-2 rounded-lg hover:bg-gray-200 cursor-pointer"
        >
          {isLoggingOut ? '...' : 'Abmelden'}
        </button>
      </div>

      <div className="w-full max-w-2xl space-y-8 flex-grow flex flex-col justify-center -mt-20 relative z-0">
        
        {/* Titres */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold text-gray-900">
            Dashboard
          </h1>
          <p className="text-gray-600 text-lg">
            Was möchten Sie tun?
          </p>
        </div>

        {/* Grille des actions */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Carte 1 : Nouveau Ticket */}
          <Link
            href="/tickets/new"
            className="group block bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:shadow-md hover:border-gray-300 transition-all duration-200"
          >
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-5 text-2xl group-hover:bg-blue-100 transition">
              📝
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Neues Ticket
            </h2>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Einen neuen Mangel melden. Fotos hochladen und Details angeben.
            </p>
            <div className="flex items-center text-sm font-medium text-blue-600 group-hover:underline underline-offset-4">
              Erstellen <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
            </div>
          </Link>

          {/* Carte 2 : Mes Tickets */}
          <Link
            href="/tickets/existing"
            className="group block bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:shadow-md hover:border-gray-300 transition-all duration-200"
          >
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center mb-5 text-2xl group-hover:bg-purple-100 transition">
              📂
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Meine Tickets
            </h2>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Status und Verlauf bestehender Meldungen einsehen.
            </p>
            <div className="flex items-center text-sm font-medium text-purple-600 group-hover:underline underline-offset-4">
              Ansehen <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
            </div>
          </Link>

          {/* Carte 3 : Backoffice (Visible seulement si Admin) */}
          {isAdminAm && (
            <Link
              href="/backoffice/tickets"
              className="group block bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:shadow-md hover:border-gray-300 transition-all duration-200 md:col-span-2"
            >
              <div className="w-12 h-12 bg-gray-100 text-gray-700 rounded-lg flex items-center justify-center mb-5 text-2xl group-hover:bg-gray-200 transition">
                ⚙️
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                AM/PM Backoffice
              </h2>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                Tickets verwalten, Status ändern, externe Dienstleister suchen und beauftragen.
              </p>
              <div className="flex items-center text-sm font-medium text-gray-900 group-hover:underline underline-offset-4">
                Öffnen <span className="ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
              </div>
            </Link>
          )}

        </div>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            © Mangelmanagement System
          </p>
        </div>
      </div>
    </main>
  );
}