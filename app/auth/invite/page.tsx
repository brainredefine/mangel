'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function InvitePage() {
  const router = useRouter();
  const [loadingUser, setLoadingUser] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        setErrorMsg(
          "Lien invalide ou expiré. Merci de demander une nouvelle invitation."
        );
        setLoadingUser(false);
        return;
      }

      setUserEmail(data.user.email ?? null);
      setLoadingUser(false);
    };

    loadUser();
  }, []);

  const handleSave = async () => {
    setErrorMsg(null);

    if (!password || password.length < 8) {
      setErrorMsg('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMsg('Les mots de passe ne correspondent pas.');
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      // Optionnel : rediriger vers le dashboard
      router.push('/dashboard');
    }

    setSaving(false);
  };

  if (loadingUser) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </main>
    );
  }

  if (errorMsg && !userEmail) {
    // erreur avant même d’avoir un user
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="border p-6 rounded max-w-md w-full">
          <p className="text-red-600 text-sm">{errorMsg}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="border p-6 rounded max-w-md w-full space-y-4">
        <h1 className="text-xl font-bold">Activation du compte</h1>
        {userEmail && (
          <p className="text-sm text-gray-600">
            Compte : <span className="font-mono">{userEmail}</span>
          </p>
        )}
        <p className="text-sm text-gray-600">
          Merci de définir votre mot de passe pour finaliser l’activation de
          votre compte.
        </p>

        <div>
          <label className="block text-sm mb-1">Mot de passe</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 caractères"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">
            Confirmation du mot de passe
          </label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />
        </div>

        {errorMsg && (
          <p className="text-sm text-red-600">
            {errorMsg}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full border rounded py-2 font-medium"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer le mot de passe'}
        </button>
      </div>
    </main>
  );
}
