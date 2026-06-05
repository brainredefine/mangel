// /app/tickets/new/actions.ts
//
// Public (no-account) tenant ticket flow.
// Tenants identify themselves with their Odoo tenancy id (the "Mieter-ID");
// everything runs through the service role here on the server, since tenants
// have no session.

'use server';

import { randomInt } from 'crypto';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { fetchTenancyForIdentify } from '../../../lib/odooClient';
import { notifyTenant } from '../../../lib/tenantMail';
import { logActivity } from '../../../lib/logActivity';
import { rateLimit, getClientIp } from '../../../lib/rateLimit';

export type TenancyOption = {
  id: number;
  label: string;
  asset_id: number | null;
};

export type IdentifyResult =
  | { success: true; tenancies: TenancyOption[] }
  | { success: false; error: string };

// Same generic message for "unknown id" and "wrong PLZ" so a blind scanner
// can't learn which Mieter-IDs exist by probing.
const INVALID_CREDENTIALS =
  'Mieter-ID oder Postleitzahl ist nicht korrekt. Bitte überprüfen Sie Ihre Eingabe.';

// PLZ second factor: compare zip codes ignoring surrounding whitespace.
function normalizePlz(v: string | null | undefined): string {
  return String(v ?? '').replace(/\s+/g, '');
}

/**
 * Resolve a tenancy id (the tenant's "Mieter-ID") + the object's PLZ -> the
 * matching object. The PLZ is a second factor so a valid id alone is not enough,
 * and we deliberately return no tenant PII here (the tenant re-enters contact
 * details on the form).
 */
export async function identifyTenantAction(
  tenancyIdRaw: string,
  plzRaw: string,
): Promise<IdentifyResult> {
  const ip = await getClientIp();
  if (!rateLimit(`identify:${ip}`, 10, 60_000).ok) {
    return { success: false, error: 'Zu viele Versuche. Bitte versuchen Sie es in einer Minute erneut.' };
  }

  const tenancyId = parseInt((tenancyIdRaw || '').trim(), 10);
  const plz = normalizePlz(plzRaw);
  if (!tenancyId || Number.isNaN(tenancyId) || tenancyId <= 0 || !plz) {
    return { success: false, error: INVALID_CREDENTIALS };
  }

  try {
    const tenancy = await fetchTenancyForIdentify(tenancyId);
    if (!tenancy || normalizePlz(tenancy.property_zip) !== plz) {
      return { success: false, error: INVALID_CREDENTIALS };
    }
    if (!tenancy.partner_id) {
      return {
        success: false,
        error: 'Diesem Mietvertrag ist kein Mieter zugeordnet. Bitte wenden Sie sich an Ihre Hausverwaltung.',
      };
    }

    const address = [tenancy.property_street, tenancy.property_zip, tenancy.property_city]
      .filter(Boolean)
      .join(', ');

    const option: TenancyOption = {
      id: tenancy.id,
      label: address || tenancy.name || `Objekt ${tenancy.id}`,
      asset_id: tenancy.asset_id,
    };

    return { success: true, tenancies: [option] };
  } catch (err) {
    console.error('❌ identifyTenantAction error:', err);
    return { success: false, error: 'Verbindung zu Odoo fehlgeschlagen. Bitte später erneut versuchen.' };
  }
}

// Unambiguous alphabet (no 0/O/1/I/L) so codes are easy to read over the phone.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateTrackingCode(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `MNG-${s}`;
}

export type CreateTicketResult =
  | { success: true; trackingCode: string; ticketId: string; uploaded: number }
  | { success: false; error: string };

function parseIntOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function parseBoolOrNull(v: FormDataEntryValue | null): boolean | null {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

/**
 * Create a tenant ticket. Validates the Odoo id again server-side (never trust
 * the client), inserts with the service role (created_by is null — no account),
 * uploads attachments, and returns an unguessable tracking code.
 */
export async function createTicketAction(formData: FormData): Promise<CreateTicketResult> {
  const ip = await getClientIp();
  if (!rateLimit(`create:${ip}`, 5, 600_000).ok) {
    return { success: false, error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.' };
  }

  // The tenant proves identity via a tenancy id; re-resolve it server-side so
  // the client can never spoof which tenant / objet the ticket is filed against.
  const tenancyId = parseIntOrNull(formData.get('odoo_tenancy_id'));
  if (!tenancyId || tenancyId <= 0) {
    return { success: false, error: 'Mieter-ID fehlt oder ist ungültig.' };
  }

  const plz = normalizePlz(String(formData.get('plz') || ''));
  const tenancy = await fetchTenancyForIdentify(tenancyId);
  // Re-verify the PLZ second factor server-side; never trust the client.
  if (!tenancy || normalizePlz(tenancy.property_zip) !== plz) {
    return { success: false, error: 'Mieter-ID konnte nicht bestätigt werden.' };
  }
  if (!tenancy.partner_id) {
    return { success: false, error: 'Diesem Mietvertrag ist kein Mieter zugeordnet.' };
  }
  const tenantId = tenancy.partner_id;

  const ticketType = formData.get('ticket_type') === 'request' ? 'request' : 'defect';

  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!title) return { success: false, error: 'Bitte geben Sie einen Titel ein.' };

  const priorityRaw = String(formData.get('priority') || 'medium');
  const priority = ['low', 'medium', 'high'].includes(priorityRaw) ? priorityRaw : 'medium';

  let categories: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get('categories') || '[]'));
    if (Array.isArray(parsed)) categories = parsed.filter((c) => typeof c === 'string');
  } catch {
    categories = [];
  }

  const contactName = String(formData.get('contact_name') || '').trim() || null;
  const contactEmail = String(formData.get('contact_email') || '').trim() || null;
  const contactPhone = String(formData.get('contact_phone') || '').trim() || null;

  const basePayload: Record<string, unknown> = {
    ticket_type: ticketType,
    tenant_id: tenantId,
    odoo_tenancy_id: tenancy.id,
    asset_id: tenancy.asset_id,
    created_by: null,
    made_by_pm: false,
    title,
    description,
    priority,
    status: 'new',
    categories,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    building_section: String(formData.get('building_section') || '').trim() || null,
    location_description: String(formData.get('location_description') || '').trim() || null,
    access_required: parseBoolOrNull(formData.get('access_required')),
    access_time_window: String(formData.get('access_time_window') || '').trim() || null,
    access_instructions: String(formData.get('access_instructions') || '').trim() || null,
    attachments_description: String(formData.get('attachments_description') || '').trim() || null,
    extra_contact_info: String(formData.get('extra_contact_info') || '').trim() || null,
  };

  // Insert with a unique tracking code, retrying if we hit the unique index.
  let ticketId = '';
  let trackingCode = '';
  for (let attempt = 0; attempt < 6; attempt++) {
    trackingCode = generateTrackingCode();
    const { data, error } = await supabaseAdmin
      .from('tickets')
      .insert({ ...basePayload, tracking_code: trackingCode })
      .select('id, tracking_code')
      .single();

    if (!error && data) {
      ticketId = data.id as string;
      trackingCode = data.tracking_code as string;
      break;
    }
    if (error && error.code === '23505') continue; // tracking_code collision → retry
    console.error('❌ createTicketAction insert error:', error);
    return { success: false, error: 'Das Ticket konnte nicht erstellt werden.' };
  }

  if (!ticketId) {
    return { success: false, error: 'Das Ticket konnte nicht erstellt werden.' };
  }

  // Upload attachments via the service role (bypasses storage RLS).
  const files = formData
    .getAll('files')
    .filter((f): f is File => f instanceof File && f.size > 0);

  let uploaded = 0;
  for (const file of files) {
    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${tenantId}/${ticketId}/${Date.now()}-${sanitized}`;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabaseAdmin.storage
        .from('ticket_attachments')
        .upload(path, buffer, { contentType: file.type || 'application/octet-stream' });

      if (uploadError) {
        console.error('❌ upload error', file.name, uploadError);
        continue;
      }

      await supabaseAdmin.from('ticket_attachments').insert({
        ticket_id: ticketId,
        uploaded_by: null,
        file_path: path,
        original_name: file.name,
        mime_type: file.type || null,
      });
      uploaded++;
    } catch (e) {
      console.error('❌ upload exception', file.name, e);
    }
  }

  // Aktivität protokollieren + Best-effort Eingangsbestätigung (no-op, falls deaktiviert).
  await logActivity({ ticketId, type: 'created', detail: 'Ticket erstellt', actorName: 'Mieter' });
  await notifyTenant(ticketId, 'created');

  return { success: true, trackingCode, ticketId, uploaded };
}
