'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'error' | 'success' | 'info', text: string } | null>({
        type: 'info', text: 'Validating secured link...'
    });
    const [isSessionReady, setIsSessionReady] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const initializeSession = async () => {
            // 1. Récupération du Hash dans l'URL
            const hash = window.location.hash;
            
            // 2. Si on a un Hash, on tente de l'injecter MANUELLEMENT
            // C'est ça qui va régler ton problème : on n'attend pas Supabase, on le force.
            if (hash && hash.includes('access_token')) {
                try {
                    // On enlève le '#' du début pour parser les paramètres
                    const params = new URLSearchParams(hash.substring(1));
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');

                    if (accessToken && refreshToken) {
                        // FORCE LA SESSION
                        const { error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });

                        if (!error) {
                            console.log("Session forcée avec succès via Hash URL");
                            setIsSessionReady(true);
                            setMsg(null);
                            return; // On arrête là, c'est gagné
                        } else {
                            console.error("Erreur setSession:", error);
                        }
                    }
                } catch (e) {
                    console.error("Erreur parsing hash:", e);
                }
            }

            // 3. Si pas de Hash ou échec manuel, on vérifie si une session existe déjà (cookie)
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setIsSessionReady(true);
                setMsg(null);
                return;
            }

            // 4. Dernier recours : on écoute un éventuel changement tardif
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
                    setIsSessionReady(true);
                    setMsg(null);
                }
            });

            // 5. Timeout final (Filet de sécurité)
            setTimeout(async () => {
                // On revérifie une dernière fois l'état local avant de déclarer l'échec
                // car on est dans un closure, on demande l'état frais à Supabase
                const { data: { session: finalSession } } = await supabase.auth.getSession();
                
                if (!finalSession) {
                    setMsg({ type: 'error', text: "Link expired." });
                    // On laisse le message d'erreur visible 3 secondes avant de rediriger
                    setTimeout(() => router.replace('/auth'), 3000);
                }
            }, 4000);

            return () => subscription.unsubscribe();
        };

        initializeSession();
    }, [router]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg(null);
        
        // On met à jour le mdp de l'utilisateur ACTUELLEMENT connecté via le setSession ci-dessus
        const { error } = await supabase.auth.updateUser({ password });
        
        if (error) {
            setMsg({ type: 'error', text: "Erreur : " + error.message });
            setLoading(false);
        } else {
            setMsg({ type: 'success', text: "Password updated ! Redirecting..." });
            await supabase.auth.signOut();
            setTimeout(() => {
                router.replace('/auth');
            }, 1500);
        }
    };

    if (!isSessionReady) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 text-center w-full max-w-sm">
                    {msg?.type === 'error' ? (
                        <div className="text-red-600 mb-4">
                            <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="font-bold">{msg.text}</p>
                        </div>
                    ) : (
                        <>
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                            <p className="text-sm text-gray-500">{msg?.text || "Loading..."}</p>
                        </>
                    )}
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100 animate-in fade-in zoom-in duration-300">
                <h1 className="text-xl font-bold text-gray-900 text-center mb-6">New password</h1>
                
                <form onSubmit={handleUpdate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
                        <input 
                            type="password" 
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none transition-all"
                            required 
                            minLength={6}
                        />
                    </div>
                    
                    {msg && (
                        <div className={`p-3 rounded-lg text-sm font-medium ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            {msg.text}
                        </div>
                    )}

                    <button disabled={loading} className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 transition-all shadow-lg">
                        {loading ? 'Saving...' : 'Confirm'}
                    </button>
                </form>
            </div>
        </main>
    )
}