// app/auth/actions.ts
'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { headers } from 'next/headers';

// --- ACTIVATION (MODIFIÉ) ---
export async function activateAccountAction(formData: FormData) {
  const odooId = formData.get('odooId') as string;
  const accessCode = formData.get('accessCode') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  
  // Récupération de l'origine pour construire l'URL de redirection correcte
  const origin = (await headers()).get('origin'); 

  // 1. Vérif Code Papier
  const { data: invite } = await supabaseAdmin
    .from('tenant_invites')
    .select('*')
    .eq('odoo_id', odooId)
    .eq('access_code', accessCode)
    .single();

  if (!invite || invite.is_claimed) {
    return { success: false, message: "Code invalide ou déjà utilisé." };
  }

  // 2. Création User (SANS auto-confirm)
  // On utilise supabaseAdmin pour créer, mais on veut déclencher l'envoi d'email.
  // Note: admin.createUser ne déclenche pas toujours l'email automatiquement selon la config.
  // Pour être sûr, on crée l'user, puis on déclenche un 'resend' ou on le configure à false.
  
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // <-- IMPORTANT : L'utilisateur doit confirmer son email
    user_metadata: { odoo_id: odooId }
  });

  if (authError) return { success: false, message: authError.message };
  const userId = authData.user!.id;

  // 3. Création Profil
  await supabaseAdmin.from('profiles').insert({
      id: userId,
      odoo_id: odooId,
      tenant_id: odooId,
      role: 'tenant_user',
      full_name: email.split('@')[0]
  });

  // 4. Marquer l'invite comme claimed
  await supabaseAdmin
    .from('tenant_invites')
    .update({ is_claimed: true, claimed_by: userId, claimed_at: new Date().toISOString() })
    .eq('odoo_id', odooId);

  // 5. Déclencher l'envoi de l'email de confirmation via Supabase
  // On redirige vers le dashboard après confirmation
  await supabaseAdmin.auth.resend({
    type: 'signup',
    email: email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`
    }
  });

  return { success: true, message: "Compte créé ! Vérifiez vos emails pour valider." };
}

// --- FORGOT PASSWORD (NOUVEAU) ---
export async function forgotPasswordAction(email: string) {
  const origin = (await headers()).get('origin');

  // Supabase envoie l'email. Si l'email n'existe pas, par sécurité, Supabase ne dit rien (ou peut être configuré pour ne rien dire).
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset-password`, 
    // On redirigera vers une page spéciale pour entrer le nouveau mot de passe
  });

  if (error) return { success: false, message: error.message };

  return { success: true, message: "Si un compte existe, un email a été envoyé." };
}