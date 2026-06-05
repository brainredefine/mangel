// app/auth/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { forgotPasswordAction } from './actions';
import { Button, Card, Field, Input, Spinner, cn } from '@/components/ui';

type AuthMode = 'LOGIN' | 'FORGOT';

function AuthFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');

  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(
    errorParam ? { type: 'error', text: 'Ein Fehler ist aufgetreten.' } : null
  );

  useEffect(() => {
    const hash = window.location.hash;

    if (hash && hash.includes('type=recovery')) {
      setLoading(true);
      setMessage({ type: 'success', text: 'Token erkannt. Weiterleitung...' });
      setTimeout(() => router.replace('/auth/reset-password' + hash), 500);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setLoading(true);
        router.replace('/auth/reset-password' + window.location.hash);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

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
      setMessage({ type: 'error', text: 'E-Mail oder Passwort ist falsch.' });
      setLoading(false);
    } else {
      router.refresh();
      router.push('/dashboard');
    }
  };

  const handleForgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    await forgotPasswordAction(formData.get('email') as string);
    setMessage({ type: 'success', text: 'Falls dieses Konto existiert, erhalten Sie einen Link.' });
    setLoading(false);
  };

  return (
    <Card className="w-full max-w-sm p-8">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <Image src="/logo.png" alt="Logo" width={180} height={50} priority className="h-10 w-auto" />
      </div>

      {/* Message */}
      {message && (
        <div
          className={cn(
            'mb-6 rounded-lg border p-3 text-sm',
            message.type === 'error'
              ? 'border-red-100 bg-red-50 text-red-600'
              : 'border-emerald-100 bg-emerald-50 text-emerald-700'
          )}
        >
          {message.text}
        </div>
      )}

      {/* LOGIN */}
      {mode === 'LOGIN' && (
        <>
          <h1 className="mb-8 text-center text-xl font-semibold text-zinc-900">
            Bei Ihrem Konto anmelden
          </h1>

          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="E-Mail">
              <Input name="email" type="email" required placeholder="name@beispiel.de" />
            </Field>
            <Field label="Passwort">
              <Input name="password" type="password" required placeholder="••••••••" />
            </Field>
            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Anmeldung...' : 'Anmelden'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode('FORGOT');
                setMessage(null);
              }}
              className="text-sm text-zinc-500 hover:text-zinc-900"
            >
              Passwort vergessen?
            </button>
          </div>
        </>
      )}

      {/* FORGOT */}
      {mode === 'FORGOT' && (
        <>
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-zinc-900">Passwort zurücksetzen</h1>
            <button
              onClick={() => {
                setMode('LOGIN');
                setMessage(null);
              }}
              className="text-sm text-zinc-500 hover:text-zinc-900"
            >
              ← Zurück
            </button>
          </div>

          <form onSubmit={handleForgot} className="space-y-4">
            <Field label="E-Mail">
              <Input name="email" type="email" required placeholder="name@beispiel.de" />
            </Field>
            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Senden...' : 'Link senden'}
            </Button>
          </form>
        </>
      )}

      {/* Footer */}
      <p className="mt-10 text-center text-xs text-zinc-300">
        © 2025 Redefine Asset &amp; Property Management
      </p>
    </Card>
  );
}

export default function AuthPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <Suspense fallback={<Spinner className="h-8 w-8 text-zinc-400" />}>
        <AuthFormContent />
      </Suspense>
    </main>
  );
}
