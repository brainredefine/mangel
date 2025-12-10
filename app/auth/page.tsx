// app/auth/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { activateAccountAction, forgotPasswordAction } from './actions';

type AuthMode = 'LOGIN' | 'ACTIVATE' | 'FORGOT';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Gestion de l'état initial via les paramètres d'URL (?view=activate ou ?error=...)
  const initialMode = (searchParams.get('view') === 'activate') ? 'ACTIVATE' : 'LOGIN';
  const errorParam = searchParams.get('error');

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(
    errorParam ? { type: 'error', text: 'Une erreur est survenue lors de l\'authentification.' } : null
  );

// --- 1. GESTION CRITIQUE DU MOT DE PASSE OUBLIÉ ---
  useEffect(() => {
    const hash = window.location.hash;
    
    // Si on détecte le token de récupération
    if (hash && hash.includes('type=recovery')) {
      setLoading(true);
      setMessage({ type: 'success', text: 'Token détecté. Redirection vers le changement de mot de passe...' });
      
      // ASTUCE CRUCIALE : On redirige EN GARDANT LE HASH
      // Ainsi la page suivante pourra lire le token et créer la session
      setTimeout(() => {
        // On concatène le hash actuel à la nouvelle URL
        router.replace('/auth/reset-password' + hash); 
      }, 500); // 500ms suffisent largement maintenant

      return;
    }

    // Écouteur standard (Filet de sécurité)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setLoading(true);
        router.replace('/auth/reset-password');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);


  // --- 2. HANDLERS DU FORMULAIRE ---

  // -> CONNEXION
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    });

    if (error) {
      setMessage({ type: 'error', text: "Email ou mot de passe incorrect." });
      setLoading(false);
    } else {
      // Le middleware gère la protection, mais on force la redirection pour l'UX
      router.refresh();
      router.push('/dashboard');
    }
  };

  // -> ACTIVATION DE COMPTE (AVEC CODE ODOO)
  const handleActivate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    
    // Vérif mot de passe local
    const p1 = formData.get('password') as string;
    const p2 = formData.get('confirmPassword') as string;
    
    if (p1 !== p2) {
        setMessage({ type: 'error', text: "Les mots de passe ne correspondent pas." });
        setLoading(false);
        return;
    }
    if (p1.length < 6) {
        setMessage({ type: 'error', text: "Le mot de passe doit faire au moins 6 caractères." });
        setLoading(false);
        return;
    }

    // Appel Server Action
    const res = await activateAccountAction(formData);

    if (res.success) {
      setMessage({ type: 'success', text: "Compte créé avec succès ! Vérifiez vos emails pour confirmer votre adresse." });
      setMode('LOGIN'); 
      // On vide le formulaire si besoin, ou on laisse l'user aller sur login
    } else {
      setMessage({ type: 'error', text: res.message || "Erreur lors de l'activation." });
    }
    setLoading(false);
  };

  // -> MOT DE PASSE OUBLIÉ
  const handleForgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    // Appel Server Action
    const res = await forgotPasswordAction(email);
    
    // On affiche toujours un succès pour éviter l'énumération d'utilisateurs
    setMessage({ 
        type: 'success', 
        text: "Si cet email correspond à un compte, vous allez recevoir un lien de réinitialisation." 
    });
    setLoading(false);
  };


  // --- 3. RENDU VISUEL ---
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* EN-TÊTE AVEC ONGLETS */}
        <div className="bg-gray-900 pt-8 pb-0 relative">
           <div className="px-8 pb-8 text-center">
             <div className="mx-auto w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mb-4 shadow-lg border border-gray-700">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
             </div>
             <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Espace Locataire</h1>
             <p className="text-gray-400 text-sm">Bienvenue sur votre portail de gestion</p>
           </div>
           
           {/* Barre d'onglets */}
           <div className="flex w-full bg-gray-800/50 backdrop-blur-sm">
             <button 
               onClick={() => { setMode('LOGIN'); setMessage(null); }}
               className={`flex-1 py-4 text-sm font-semibold transition-all duration-200 border-b-2 ${
                 mode === 'LOGIN' || mode === 'FORGOT' 
                  ? 'border-white text-white bg-white/5' 
                  : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
               }`}
             >
               Connexion
             </button>
             <button 
               onClick={() => { setMode('ACTIVATE'); setMessage(null); }}
               className={`flex-1 py-4 text-sm font-semibold transition-all duration-200 border-b-2 ${
                 mode === 'ACTIVATE' 
                  ? 'border-blue-500 text-white bg-blue-500/10' 
                  : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
               }`}
             >
               Première visite ?
             </button>
           </div>
        </div>

        <div className="p-8">
          
          {/* ZONE DE NOTIFICATION */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
                message.type === 'error' 
                ? 'bg-red-50 text-red-600 border border-red-100' 
                : 'bg-green-50 text-green-700 border border-green-100'
            }`}>
              <span className="text-lg mt-[-2px]">{message.type === 'error' ? '⚠️' : '✅'}</span>
              {message.text}
            </div>
          )}

          {/* --- FORMULAIRE : LOGIN --- */}
          {mode === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-700 ml-1">Email</label>
                <input 
                  name="email" 
                  type="email" 
                  required 
                  placeholder="nom@exemple.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none" 
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                    <label className="block text-sm font-bold text-gray-700">Mot de passe</label>
                    <button type="button" onClick={() => setMode('FORGOT')} className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline">
                      Mot de passe oublié ?
                    </button>
                </div>
                <input 
                  name="password" 
                  type="password" 
                  required 
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none" 
                />
              </div>
              <button 
                disabled={loading} 
                className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-gray-800 hover:shadow-xl focus:ring-4 focus:ring-gray-200 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-wait"
              >
                {loading ? 'Connexion en cours...' : 'Se connecter'}
              </button>
            </form>
          )}

          {/* --- FORMULAIRE : ACTIVATE --- */}
          {mode === 'ACTIVATE' && (
            <form onSubmit={handleActivate} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 flex gap-3">
                <span className="text-xl">📬</span>
                <div>
                  <p className="font-bold mb-1">Activer votre compte</p>
                  <p className="opacity-90">Utilisez les identifiants présents sur le courrier que vous avez reçu.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">ID Odoo</label>
                    <input name="odooId" placeholder="Ex: 12345" required className="w-full px-3 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">Code</label>
                    <input name="accessCode" placeholder="Ex: AB-12" required className="w-full px-3 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none uppercase font-mono transition-all" />
                </div>
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                <div className="relative flex justify-center"><span className="bg-white px-4 text-xs text-gray-400 font-medium uppercase">Vos identifiants</span></div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-700 ml-1">Votre Email</label>
                <input name="email" type="email" required placeholder="nom@exemple.com" className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-gray-700 ml-1">Mot de passe</label>
                    <input name="password" type="password" required minLength={6} placeholder="Min. 6 car." className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-gray-700 ml-1">Confirmation</label>
                    <input name="confirmPassword" type="password" required minLength={6} placeholder="Répéter" className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
              </div>

              <button 
                disabled={loading} 
                className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 hover:shadow-xl focus:ring-4 focus:ring-blue-200 transition-all active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? 'Activation en cours...' : 'Activer mon accès'}
              </button>
            </form>
          )}

          {/* --- FORMULAIRE : FORGOT PASSWORD --- */}
          {mode === 'FORGOT' && (
            <div className="animate-in fade-in zoom-in duration-300">
                <button 
                    onClick={() => setMode('LOGIN')} 
                    className="mb-6 flex items-center text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors group"
                >
                    <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-2 group-hover:bg-gray-200 transition-colors">←</span>
                    Retour à la connexion
                </button>
                
                <div className="text-center mb-6">
                    <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 14l-1 1-1 1H6v-1l4-4 1-1" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Réinitialisation</h3>
                    <p className="text-sm text-gray-500 mt-1">Entrez votre email pour recevoir un lien magique.</p>
                </div>

                <form onSubmit={handleForgot} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-gray-700 ml-1">Email associé au compte</label>
                        <input name="email" type="email" required className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none transition-all" />
                    </div>
                    <button disabled={loading} className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-gray-800 disabled:opacity-70 transition-all">
                        {loading ? 'Envoi...' : 'Envoyer le lien de récupération'}
                    </button>
                </form>
            </div>
          )}

        </div>
        
        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">© 2025 Système de Gestion Immobilière</p>
        </div>
      </div>
    </main>
  );
}