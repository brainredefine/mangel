// app/sign-in/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    console.log("1. Tentative de connexion avec :", email);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("2. Erreur Supabase :", error); // L'erreur s'affichera ici
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      console.log("2. Connexion réussie !", data);
      console.log("3. Rafraîchissement du routeur...");
      
      router.refresh();
      
      console.log("4. Redirection vers /dashboard...");
      router.push('/dashboard');

    } catch (err) {
      console.error("ERREUR CRITIQUE DANS LE CATCH :", err);
      setErrorMsg("Erreur technique inattendue.");
      setLoading(false);
    }
  };

  // --- RENDER (DESIGN MIS À JOUR) ---
  return (
    <main className="min-h-screen w-full bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        
        {/* Header de la carte */}
        <div className="px-8 pt-8 pb-6 text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mb-4 shadow-lg transform rotate-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Willkommen zurück
          </h1>
          <p className="text-sm text-gray-500">
            Bitte melden Sie sich an, um fortzufahren.
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-6">
          
          {/* Champ Email */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 ml-1">
              Email Adresse
            </label>
            <input
              type="email"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@firma.com"
              required
            />
          </div>

          {/* Champ Mot de passe */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 ml-1">
              Passwort
            </label>
            <input
              type="password"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {/* Message d'erreur */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 animate-pulse">
              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600 font-medium">{errorMsg}</p>
            </div>
          )}

          {/* Bouton de soumission */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white font-semibold py-3.5 rounded-xl shadow-lg hover:bg-gray-800 hover:shadow-xl focus:ring-4 focus:ring-gray-200 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Wird angemeldet...</span>
              </>
            ) : (
              'Anmelden'
            )}
          </button>
        </form>

        {/* Footer (Optionnel) */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            © 2025 Asset Management System
          </p>
        </div>
      </div>
    </main>
  );
}