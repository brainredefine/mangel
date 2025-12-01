'use server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function verifyActivationCode(odooId: string, code: string) {
  // 1. Chercher l'invitation
  const { data: invite, error } = await supabaseAdmin
    .from('tenant_invites')
    .select('*')
    .eq('odoo_id', odooId)
    .eq('access_code', code) // Note: en prod, compare des hashs !
    .eq('is_claimed', false)
    .single();

  if (error || !invite) {
    return { success: false, message: "Code invalide ou compte déjà activé." };
  }

  return { success: true };
}

export async function finalizeActivation(odooId: string, code: string, email: string, password: string) {
    // 1. Re-vérifier (sécurité double)
    const check = await verifyActivationCode(odooId, code);
    if (!check.success) return check;

    // 2. Créer l'utilisateur Auth via Admin pour être sûr de passer les metadata
    // On utilise admin pour contourner la confirmation email si besoin, 
    // ou on utilise le client normal si tu veux la verification email.
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Auto-confirm car ils ont le code papier ? À toi de voir.
        user_metadata: {
            odoo_id: odooId
        }
    });

    if (authError) return { success: false, message: authError.message };

    // 3. Marquer l'invitation comme utilisée
    await supabaseAdmin
        .from('tenant_invites')
        .update({ is_claimed: true })
        .eq('odoo_id', odooId);

    return { success: true };
}