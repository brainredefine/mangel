// app/auth/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { activateAccountAction, forgotPasswordAction } from './actions';

type AuthMode = 'LOGIN' | 'ACTIVATE' | 'FORGOT';

function AuthFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialMode = searchParams.get('view') === 'activate' ? 'ACTIVATE' : 'LOGIN';
  const errorParam = searchParams.get('error');

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(
    errorParam ? { type: 'error', text: 'An error occured.' } : null
  );

  useEffect(() => {
    const hash = window.location.hash;

    if (hash && hash.includes('type=recovery')) {
      setLoading(true);
      setMessage({ type: 'success', text: 'Token detected. Redirecting...' });

      setTimeout(() => {
        router.replace('/auth/reset-password' + hash);
      }, 500);

      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
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
      setMessage({ type: 'error', text: 'Incorrect email or password.' });
      setLoading(false);
    } else {
      router.refresh();
      router.push('/dashboard');
    }
  };

  const handleActivate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);

    const p1 = formData.get('password') as string;
    const p2 = formData.get('confirmPassword') as string;

    if (p1 !== p2) {
      setMessage({ type: 'error', text: 'Passwords need to be the same.' });
      setLoading(false);
      return;
    }
    if (p1.length < 8) {
      setMessage({ type: 'error', text: 'Password must be atleast 8 caracters long.' });
      setLoading(false);
      return;
    }

    const res = await activateAccountAction(formData);

    if (res.success) {
      setMessage({
        type: 'success',
        text: 'Account successfully created ! Check your email to confirm.',
      });
      setMode('LOGIN');
    } else {
      setMessage({ type: 'error', text: res.message || 'Error while activating the account.' });
    }
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    await forgotPasswordAction(email);

    setMessage({
      type: 'success',
      text: 'If this email is linked to an account, you will receive an email shortly.',
    });
    setLoading(false);
  };

  const activateInput =
    'w-full rounded-xl border border-gray-300 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all';
  const loginInput =
    'w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all outline-none';

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
      <div className="bg-gray-900 pt-8 pb-0 relative">
        <div className="px-8 pb-8 text-center">
          <div className="mx-auto w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mb-4 shadow-lg border border-gray-700">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Tenant space</h1>
          <p className="text-gray-400 text-sm">Welcome on your profile</p>
        </div>

        <div className="flex w-full bg-gray-800/50 backdrop-blur-sm">
          <button
            onClick={() => {
              setMode('LOGIN');
              setMessage(null);
            }}
            className={`flex-1 py-4 text-sm font-semibold transition-all duration-200 border-b-2 ${
              mode === 'LOGIN' || mode === 'FORGOT'
                ? 'border-white text-white bg-white/5'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => {
              setMode('ACTIVATE');
              setMessage(null);
            }}
            className={`flex-1 py-4 text-sm font-semibold transition-all duration-200 border-b-2 ${
              mode === 'ACTIVATE'
                ? 'border-blue-500 text-white bg-blue-500/10'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            First login ?
          </button>
        </div>
      </div>

      <div className="p-8">
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
              message.type === 'error'
                ? 'bg-red-50 text-red-600 border border-red-100'
                : 'bg-green-50 text-green-700 border border-green-100'
            }`}
          >
            <span className="text-lg mt-[-2px]">{message.type === 'error' ? '⚠️' : '✅'}</span>
            {message.text}
          </div>
        )}

        {mode === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700 ml-1">Email</label>
              <input name="email" type="email" required placeholder="nom@exemple.com" className={loginInput} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="block text-sm font-bold text-gray-700">Password</label>
                <button
                  type="button"
                  onClick={() => setMode('FORGOT')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Forgot Password ?
                </button>
              </div>
              <input name="password" type="password" required placeholder="••••••••" className={loginInput} />
            </div>
            <button
              disabled={loading}
              className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-gray-800 hover:shadow-xl focus:ring-4 focus:ring-gray-200 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-wait"
            >
              {loading ? 'Logging in...' : 'Login in'}
            </button>
          </form>
        )}

        {mode === 'ACTIVATE' && (
          <form onSubmit={handleActivate} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 flex gap-3">
              <span className="text-xl">📬</span>
              <div>
                <p className="font-bold mb-1">Activate your account</p>
                <p className="opacity-90">Use the login details provided in the email you received.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">ID Odoo</label>
                <input name="odooId" placeholder="Ex: 12345" required className={`${activateInput} px-3 py-3`} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">Code</label>
                <input
                  name="accessCode"
                  placeholder="Ex: AB-12"
                  required
                  className={`${activateInput} px-3 py-3 uppercase font-mono`}
                />
              </div>
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-xs text-gray-400 font-medium uppercase">Your login details</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700 ml-1">Your Email</label>
              <input
                name="email"
                type="email"
                required
                placeholder="name@example.com"
                className={`${activateInput} px-4 py-3`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-700 ml-1">Password</label>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Min. 8 car."
                  className={`${activateInput} px-4 py-3`}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-700 ml-1">Confirm Password</label>
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Repeat"
                  className={`${activateInput} px-4 py-3`}
                />
              </div>
            </div>

            <button
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 hover:shadow-xl focus:ring-4 focus:ring-blue-200 transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {loading ? 'Activating...' : 'Activate my access'}
            </button>
          </form>
        )}

        {mode === 'FORGOT' && (
          <div className="animate-in fade-in zoom-in duration-300">
            <button
              onClick={() => setMode('LOGIN')}
              className="mb-6 flex items-center text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors group"
            >
              <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-2 group-hover:bg-gray-200 transition-colors">
                ←
              </span>
              Back to login
            </button>

            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 14l-1 1-1 1H6v-1l4-4 1-1"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Reset</h3>
              <p className="text-sm text-gray-500 mt-1">Enter your email address to receive a magic link.</p>
            </div>

            <form onSubmit={handleForgot} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-gray-700 ml-1">Email associated with the account</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none transition-all"
                />
              </div>
              <button
                disabled={loading}
                className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-gray-800 disabled:opacity-70 transition-all"
              >
                {loading ? 'Sending...' : 'Send the recovery link'}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">© 2025 Redefine Asset & Property Management</p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      {/* Wrapper = même largeur que la carte, pour pouvoir placer le logo "hors cadre" */}
      <div className="w-full max-w-md relative">
        {/* Logo en dehors du cadre (au-dessus) */}
        <div className="absolute -top-22 left-20">
          <Image
            src="/logo.png"
            alt="Logo"
            width={360}
            height={200}
            priority
            className="h-16 w-auto"
          />
        </div>

        <Suspense
          fallback={
            <div className="w-full bg-white rounded-2xl shadow-xl h-[600px] flex items-center justify-center border border-gray-100">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          }
        >
          <AuthFormContent />
        </Suspense>
      </div>
    </main>
  );
}
