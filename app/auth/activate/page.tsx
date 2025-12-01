'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { verifyCodeAction, activateAccountAction } from './actions';

export default function ActivatePage() {
  const router = useRouter();
  
  // États du wizard
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1=Code, 2=Email/Mdp, 3=Succès
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Données du formulaire
  const [odooId, setOdooId] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // --- Étape 1 : Vérification du Code ---
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await verifyCodeAction(odooId, accessCode);
      if (res.success) {
        setStep(2); // On passe à l'étape suivante
      } else {
        setErrorMsg(res.message || 'Erreur inconnue');
      }
    } catch (err) {
      setErrorMsg("Une erreur technique est survenue.");
    } finally {
      setLoading(false);
    }
  };

  // --- Étape 2 : Création du compte ---
  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setErrorMsg("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('odooId', odooId);
    formData.append('accessCode', accessCode);
    formData.append('email', email);
    formData.append('password', password);

    try {
      const res = await activateAccountAction(formData);
      if (res.success) {
        setStep(3); // Succès final
        // Redirection automatique après 3 secondes
        setTimeout(() => {
          router.push('/sign-in');
        }, 3000);
      } else {
        setErrorMsg(res.message || "Erreur lors de l'activation.");
      }
    } catch (err) {
      setErrorMsg("Erreur technique lors de la création du compte.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md space-y-6">
        
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Activation de compte</h1>
          {step === 1 && (
            <p className="text-sm text-gray-600">
              Entrez les identifiants reçus par courrier pour activer votre espace locataire.
            </p>
          )}
          {step === 2 && (
            <p className="text-sm text-gray-600">
              Vérification réussie ! Choisissez maintenant vos identifiants de connexion.
            </p>
          )}
        </div>

        {/* --- STEP 1 : Code Odoo --- */}
        {step === 1 && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Identifiant Locataire (Odoo ID)
              </label>
              <input
                type="text"
                required
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ex: 12345"
                value={odooId}
                onChange={(e) => setOdooId(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code d'activation
              </label>
              <input
                type="text"
                required
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none uppercase font-mono"
                placeholder="Ex: AF34-X"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Vérification...' : 'Continuer'}
            </button>
          </form>
        )}

        {/* --- STEP 2 : Choix Email/Password --- */}
        {step === 2 && (
          <form onSubmit={handleActivate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Votre adresse email
              </label>
              <input
                type="email"
                required
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Choisissez un mot de passe
              </label>
              <input
                type="password"
                required
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmez le mot de passe
              </label>
              <input
                type="password"
                required
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {errorMsg}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 border py-2 rounded text-gray-600 hover:bg-gray-50"
              >
                Retour
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 bg-green-600 text-white py-2 rounded hover:bg-green-700 transition disabled:opacity-50"
              >
                {loading ? 'Activation en cours...' : 'Activer mon compte'}
              </button>
            </div>
          </form>
        )}

        {/* --- STEP 3 : Succès --- */}
        {step === 3 && (
          <div className="text-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-3xl">
              ✓
            </div>
            <h2 className="text-xl font-semibold text-green-700">Compte activé !</h2>
            <p className="text-gray-600 text-sm">
              Votre compte a été créé avec succès.<br/>
              Vous allez être redirigé vers la page de connexion...
            </p>
            <button
              onClick={() => router.push('/sign-in')}
              className="text-blue-600 underline text-sm mt-2"
            >
              Aller à la connexion maintenant
            </button>
          </div>
        )}
      </div>
    </main>
  );
}