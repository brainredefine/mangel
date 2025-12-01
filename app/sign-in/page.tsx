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


  return (
    <main className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md border p-6 rounded-lg space-y-4"
      >
        <h1 className="text-2xl font-bold">Login</h1>

        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            className="w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full border rounded py-2 font-medium"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
