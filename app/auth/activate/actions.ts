// /app/auth/activate/actions.ts

'use server';

import { supabaseAdmin } from '../../../lib/supabaseAdmin';

type ActionResponse = {
  success: boolean;
  message?: string;
};

// Vérification simple (Lecture seule)
export async function verifyCodeAction(odooId: string, accessCode: string): Promise<ActionResponse> {
  if (!odooId || !accessCode) return { success: false, message: 'Identifiant et code requis.' };

  const { data, error } = await supabaseAdmin
    .from('tenant_invites')
    .select('id, is_claimed')
    .eq('odoo_id', odooId)
    .eq('access_code', accessCode)
    .single();

  if (error || !data) return { success: false, message: 'Code invalide.' };
  if (data.is_claimed) return { success: false, message: 'Ce code a déjà été activé.' };

  return { success: true };
}

// Activation complète (Écriture avec sécurités)
export async function activateAccountAction(formData: FormData): Promise<ActionResponse> {
  const odooId = formData.get('odooId') as string;
  const accessCode = formData.get('accessCode') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  // 1. Vérification préliminaire
  const check = await verifyCodeAction(odooId, accessCode);
  if (!check.success) return check;

  // 2. Création de l'utilisateur Auth (Identity)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirmation car ils ont le code papier
    user_metadata: { odoo_id: odooId }
  });

  if (authError) {
    // Message plus clair si l'utilisateur existe déjà
    if (authError.message.includes('already registered')) {
        return { success: false, message: 'Un compte existe déjà avec cet email.' };
    }
    return { success: false, message: authError.message };
  }

  if (!authData.user) {
    return { success: false, message: "Erreur technique lors de la création de l'utilisateur." };
  }

  const userId = authData.user.id;

  // 3. Création du Profil (Public)
  // Si ça échoue, on doit supprimer l'utilisateur Auth qu'on vient de créer (Rollback)
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: userId,
      odoo_id: odooId,
      tenant_id: odooId,
      role: 'tenant_user',
      full_name: email.split('@')[0] // Nom par défaut basé sur l'email
    });

  if (profileError) {
    console.error('Erreur Profile, suppression Auth:', profileError);
    await supabaseAdmin.auth.admin.deleteUser(userId); // ROLLBACK ÉTAPE 1
    return { success: false, message: "Erreur lors de l'initialisation du profil." };
  }

  // 4. Validation de l'invitation
  // Si ça échoue, c'est grave : on a un user + profil mais le code reste valide.
  // On doit tout supprimer.
  const { error: inviteError } = await supabaseAdmin
    .from('tenant_invites')
    .update({ 
      is_claimed: true, 
      claimed_at: new Date().toISOString(), 
      claimed_by: userId 
    })
    .eq('odoo_id', odooId)
    .eq('access_code', accessCode);

  if (inviteError) {
    console.error('Erreur Invite, suppression totale:', inviteError);
    // ROLLBACK TOTAL
    await supabaseAdmin.from('profiles').delete().eq('id', userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return { success: false, message: "Erreur lors de la validation finale du code." };
  }

  return { success: true };
}