// app/auth/actions.ts
'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { headers } from 'next/headers';

type ActionResponse = {
  success: boolean;
  message?: string;
};

// --- FORGOT PASSWORD ---
export async function forgotPasswordAction(email: string): Promise<ActionResponse> {
  const origin = (await headers()).get('origin');
  const cleanEmail = email.toLowerCase().trim();

  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
  });

  if (error) {
    console.error('Erreur reset password:', error);
  }

  return { success: true, message: 'Falls ein Konto existiert, wurde eine E-Mail gesendet.' };
}
