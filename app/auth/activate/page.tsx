// /app/auth/activate/page.tsx

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
        setErrorMsg(res.message || 'Unbekannter Fehler');
      }
    } catch (err) {
      setErrorMsg("Ein technischer Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  // --- Étape 2 : Création du compte ---
  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setErrorMsg("Die Passwörter stimmen nicht überein.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Das Passwort muss mindestens 6 Zeichen lang sein.");
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
        setErrorMsg(res.message || "Fehler bei der Aktivierung.");
      }
    } catch (err) {
      setErrorMsg("Technischer Fehler bei der Kontoerstellung.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md space-y-6 border border-gray-200">
        
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 text-black">Kontoaktivierung</h1>
          {step === 1 && (
            <p className="text-sm text-black font-medium">
              Bitte geben Sie die Zugangsdaten ein, die Sie per Post erhalten haben, um Ihren Mieterbereich zu aktivieren.
            </p>
          )}
          {step === 2 && (
            <p className="text-sm text-black font-medium">
              Überprüfung erfolgreich! Bitte wählen Sie nun Ihre Zugangsdaten.
            </p>
          )}
        </div>

        {/* --- STEP 1 : Code Odoo --- */}
        {step === 1 && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-black mb-1">
                Mieter-ID (Odoo ID)
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-black"
                placeholder="z.B.: 12345"
                value={odooId}
                onChange={(e) => setOdooId(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-1">
                Aktivierungscode
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none uppercase font-mono text-black"
                placeholder="z.B.: AF34-X"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200 font-medium">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition disabled:opacity-50 font-bold"
            >
              {loading ? 'Überprüfung...' : 'Weiter'}
            </button>
          </form>
        )}

        {/* --- STEP 2 : Choix Email/Password --- */}
        {step === 2 && (
          <form onSubmit={handleActivate} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-black mb-1">
                Ihre E-Mail-Adresse
              </label>
              <input
                type="email"
                required
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-black"
                placeholder="sie@beispiel.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-1">
                Wählen Sie ein Passwort
              </label>
              <input
                type="password"
                required
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-black"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-1">
                Passwort bestätigen
              </label>
              <input
                type="password"
                required
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-black"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200 font-medium">
                {errorMsg}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 border border-gray-300 py-2 rounded text-black font-bold hover:bg-gray-100"
              >
                Zurück
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 bg-green-600 text-white py-2 rounded hover:bg-green-700 transition disabled:opacity-50 font-bold"
              >
                {loading ? 'Aktivierung läuft...' : 'Konto aktivieren'}
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
            <h2 className="text-xl font-bold text-green-700">Konto aktiviert!</h2>
            <p className="text-black text-sm font-medium">
              Ihr Konto wurde erfolgreich erstellt.<br/>
              Sie werden zur Anmeldeseite weitergeleitet...
            </p>
            <button
              onClick={() => router.push('/sign-in')}
              className="text-blue-600 underline text-sm mt-2 font-bold"
            >
              Jetzt zur Anmeldung
            </button>
          </div>
        )}
      </div>
    </main>
  );
}