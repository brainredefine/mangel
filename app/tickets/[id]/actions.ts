// app/tickets/[id]/actions.ts

'use server';

import {
  fetchBuildingInfoByTenancy,
  fetchVendorsByReference,
  createServiceProviderInOdoo,
  partnerExistsInOdoo,
  fetchOfferMailContext,
} from '../../../lib/odooClient';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getAdminUser } from '../../../lib/requireAdmin';
import { notifyTenant } from '../../../lib/tenantMail';
import { logActivity, type ActivityType } from '../../../lib/logActivity';
import { buildOfferPdf } from '../../../lib/buildOfferPdf';
import { buildOfferMail } from './mail/mailOffer';

// --- TYPES ---

type ExternalVendor = {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  sourceUrl?: string | null;
  snippet?: string | null;
  source?: string | null;
};

// --- BUILDING INFO ---

export async function getBuildingInfoAction(tenancyId: number | string) {
  try {
    const id = Number(tenancyId);

    if (!id || Number.isNaN(id)) {
      console.warn('[getBuildingInfoAction] INVALID_ID', tenancyId);
      return { success: false, error: 'INVALID_ID' };
    }

    const data = await fetchBuildingInfoByTenancy(id);

    if (!data) {
      console.warn('[getBuildingInfoAction] NOT_FOUND in Odoo for id', id);
      return { success: false, error: 'NOT_FOUND' };
    }

    return { success: true, data };
  } catch (err) {
    console.error('getBuildingInfoAction error', err);
    return { success: false, error: 'ODOO_ERROR' };
  }
}

// --- OFFER MAIL CONTEXT ---

export async function getOfferMailContextAction(tenancyId: number, tenantPartnerId: number) {
  try {
    const data = await fetchOfferMailContext({ tenancyId, tenantPartnerId });
    return { success: true, data };
  } catch (e: any) {
    console.error('[getOfferMailContextAction] error', e);
    return { success: false, error: e?.message ?? 'Unknown error' };
  }
}

// --- TENANT NOTIFICATION (admin-triggered) ---

export async function notifyTenantAction(ticketId: string, kind: 'status' | 'message') {
  const admin = await getAdminUser();
  if (!admin) return { sent: false, reason: 'unauthorized' };
  return notifyTenant(ticketId, kind);
}

// --- ACTIVITY LOG (admin-triggered) ---

export async function logTicketActivityAction(ticketId: string, type: ActivityType, detail?: string) {
  const admin = await getAdminUser();
  if (!admin) return { ok: false };

  let actorName: string | null = admin.email ?? null;
  const { data: prof } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', admin.id)
    .single();
  if (prof?.full_name) actorName = prof.full_name;

  await logActivity({ ticketId, type, detail, actorId: admin.id, actorName });
  return { ok: true };
}

// --- PREPARE BEAUFTRAGUNG MAIL (PDF download + prefilled mailto — NOT sent) ---
//
// Returns the Beauftragung PDF (base64) plus recipient/subject/body. The client
// downloads the PDF and opens a prefilled mailto; the admin attaches the PDF and
// sends from their own mailbox — so the body sits above their Outlook signature
// and the From is their own familiar address. Nothing is sent automatically.

export async function prepareOfferMailAction(
  ticketId: string,
  vendorName: string,
  vendorEmail: string
) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return { success: false as const, error: 'Nicht autorisiert.' };
    }

    const email = (vendorEmail || '').trim();
    if (!email) {
      return { success: false as const, error: 'Keine E-Mail-Adresse für diesen Dienstleister.' };
    }

    // Load the ticket fields needed for the Beauftragung
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select(
        'id, title, description, beauftragungsumme, expected_enddate, odoo_tenancy_id, tenant_id, vendor_status, beauftragt_at, tracking_code, beauftragung_count'
      )
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return { success: false as const, error: 'Ticket nicht gefunden.' };
    }

    if (!ticket.odoo_tenancy_id) {
      return { success: false as const, error: 'Keine Odoo-Mieter-ID am Ticket hinterlegt.' };
    }

    // Owner / tenant / building context from Odoo
    const ctx = await fetchOfferMailContext({
      tenancyId: Number(ticket.odoo_tenancy_id),
      tenantPartnerId: Number(ticket.tenant_id),
    });

    const companyName = ctx?.building?.company_name ?? null;
    const invoiceMailbox =
      companyName === 'Fund IV'
        ? 'inv-4@redefine.group'
        : companyName === 'Eagle'
        ? 'inv-eagle@redefine.group'
        : 'inv@redefine.group';

    // Subject location: "Straße, Stadt" (or Objekt-Label) — not a description summary
    const b = ctx?.building;
    const subjectLocation =
      [b?.property_street, b?.property_city].filter(Boolean).join(', ').trim() ||
      b?.objekt_label ||
      null;

    const newCount = (ticket.beauftragung_count ?? 0) + 1;
    const beauftragungsNummer = `${ticket.tracking_code || ticketId.split('-')[0]}-${String(newCount).padStart(2, '0')}`;

    const mail = buildOfferMail({
      vendorEmail: email,
      vendorName,
      description: ticket.description || ticket.title || 'Maßnahme',
      subjectLocation,
      beauftragungsNummer,
      ownerEntityName: ctx?.ownerEntity?.name ?? null,
      ownerEntityAddress: ctx?.ownerEntity?.address ?? null,
      ownerEntityVat: ctx?.ownerEntity?.vat ?? null,
      tenantName: ctx?.tenant?.name ?? null,
      tenantAddress: ctx?.tenant?.address ?? null,
      tenantEmail: ctx?.tenant?.email ?? null,
      tenantPhone: ctx?.tenant?.phone ?? null,
      beauftragungsummeBrutto: ticket.beauftragungsumme ?? null,
      dueDateText: ticket.expected_enddate
        ? `schnellstmöglich, spätestens zum ${String(ticket.expected_enddate).slice(0, 10)}`
        : null,
      invoiceMailbox,
    });

    const pdfBytes = await buildOfferPdf({
      subject: mail.subject,
      body: mail.body,
      vendorName,
      beauftragungsNummer,
    });
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
    const shortId = ticketId.split('-')[0];

    // Beauftragungs-Zähler hochzählen; Versand markiert den Dienstleister
    // zudem als beauftragt (einmalig).
    const updatePatch: Record<string, any> = { beauftragung_count: newCount };
    let vendorStatus: string | null = ticket.vendor_status ?? null;
    let beauftragtAt: string | null = ticket.beauftragt_at ?? null;
    if (!vendorStatus) {
      vendorStatus = 'commissioned';
      beauftragtAt = new Date().toISOString();
      updatePatch.vendor_status = vendorStatus;
      updatePatch.beauftragt_at = beauftragtAt;
    }
    await supabaseAdmin.from('tickets').update(updatePatch).eq('id', ticketId);

    await logActivity({
      ticketId,
      type: 'beauftragung',
      detail: `Beauftragung an ${vendorName} vorbereitet`,
      actorId: admin.id,
      actorName: admin.email,
    });

    return {
      success: true as const,
      to: mail.to,
      subject: mail.subject,
      body: mail.coverNote,
      pdfBase64,
      pdfFilename: `Beauftragung_${shortId}.pdf`,
      vendorStatus,
      beauftragtAt,
    };
  } catch (err: any) {
    console.error('[prepareOfferMailAction] error', err);
    return { success: false as const, error: err?.message ?? 'Unbekannter Fehler.' };
  }
}

// --- RECOMMENDED VENDORS (ODOO) ---

export async function getRecommendedVendorsAction(tenancyId: number) {
  try {
    const buildingData = await fetchBuildingInfoByTenancy(tenancyId);

    if (!buildingData) {
      console.warn('[getRecommendedVendorsAction] No buildingData for tenancyId =', tenancyId);
      return { success: false, error: 'NO_BUILDING_DATA' };
    }

    const internalLabel = (buildingData as any).property_internal_label;

    if (!internalLabel) {
      console.warn('[getRecommendedVendorsAction] No internal_label found for tenancyId =', tenancyId);
      return { success: false, error: 'NO_INTERNAL_LABEL' };
    }

    const vendors = await fetchVendorsByReference(internalLabel);
    return { success: true, data: vendors };
  } catch (err) {
    console.error('getRecommendedVendorsAction error', err);
    return { success: false, error: 'ODOO_VENDOR_ERROR' };
  }
}

// --- EXTERNAL VENDORS (GOOGLE PLACES) ---

export async function searchExternalVendorsAction(searchPrompt: string) {
  try {
    const prompt = searchPrompt?.trim();
    if (!prompt) return { success: false, error: 'EMPTY_PROMPT' };

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('[searchExternalVendorsAction] Missing GOOGLE_PLACES_API_KEY');
      return { success: false, error: 'NO_GOOGLE_KEY' };
    }

    const MAX_QUERY_LEN = 512;
    const query = prompt.slice(0, MAX_QUERY_LEN);

    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&language=de&region=de&key=${apiKey}`;

    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      const text = await searchResponse.text();
      console.error('[searchExternalVendorsAction] Google Places HTTP error', searchResponse.status, text);
      return { success: false, error: 'GOOGLE_PLACES_HTTP_ERROR' };
    }

    const searchJson = (await searchResponse.json()) as any;

    if (searchJson.status !== 'OK' && searchJson.status !== 'ZERO_RESULTS') {
      console.error('[searchExternalVendorsAction] Google Places non-OK status:', searchJson.status);
      return { success: false, error: searchJson.status || 'GOOGLE_PLACES_SEARCH_ERROR' };
    }

    const results = Array.isArray(searchJson.results) ? searchJson.results : [];
    if (!results.length) return { success: true, data: [], usedPrompt: query };

    const MAX_DETAIL_RESULTS = 8;
    const subset = results.slice(0, MAX_DETAIL_RESULTS);

    const detailedVendors: ExternalVendor[] = [];

    for (const place of subset) {
      const placeId = place.place_id;
      const name = place.name;
      const formattedAddress = place.formatted_address;
      const rating = place.rating ?? null;
      const reviewCount = place.user_ratings_total ?? null;

      let phone: string | null = null;
      let website: string | null = null;
      let email: string | null = null;
      let mapsUrl: string | null = placeId
        ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
        : null;

      if (placeId) {
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
            placeId
          )}&fields=formatted_phone_number,international_phone_number,website,url&language=de&key=${apiKey}`;

          const detailsResponse = await fetch(detailsUrl);

          if (detailsResponse.ok) {
            const detailsJson = (await detailsResponse.json()) as any;

            if (detailsJson.status === 'OK' && detailsJson.result) {
              const d = detailsJson.result;
              phone = d.formatted_phone_number || d.international_phone_number || null;
              website = d.website || null;
              if (d.url) mapsUrl = d.url;
            }
          }
        } catch (detailsErr) {
          console.error('[searchExternalVendorsAction] Details fetch error', placeId, detailsErr);
        }
      }

      // Try to extract email from website
      if (website) {
        try {
          email = await extractEmailFromWebsite(website);
        } catch (scrapeErr) {
          console.error('[searchExternalVendorsAction] Error scraping email', website, scrapeErr);
        }
      }

      detailedVendors.push({
        id: placeId || name || formattedAddress || Math.random().toString(36),
        name: name || 'Unbekannter Dienstleister',
        address: formattedAddress || null,
        phone,
        website,
        email,
        rating,
        reviewCount,
        sourceUrl: mapsUrl,
        snippet: null,
        source: 'google_places',
      });
    }

    // Sort by rating
    detailedVendors.sort((a, b) => {
      const ra = a.rating ?? 0;
      const rb = b.rating ?? 0;
      if (rb !== ra) return rb - ra;
      const ca = a.reviewCount ?? 0;
      const cb = b.reviewCount ?? 0;
      return cb - ca;
    });

    return { success: true, data: detailedVendors, usedPrompt: query };
  } catch (err) {
    console.error('[searchExternalVendorsAction] error', err);
    return { success: false, error: 'EXTERNAL_SEARCH_ERROR' };
  }
}

// --- HELPER: Extract email from website ---

async function extractEmailFromWebsite(websiteUrl: string): Promise<string | null> {
  try {
    const tried = new Set<string>();
    const urlObj = new URL(websiteUrl);
    const origin = urlObj.origin;

    const candidates: string[] = [
      websiteUrl,
      `${origin}/impressum`,
      `${origin}/impressum.html`,
      `${origin}/kontakt`,
      `${origin}/kontakt.html`,
    ];

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    for (const url of candidates) {
      if (tried.has(url)) continue;
      tried.add(url);

      try {
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) continue;

        const html = await res.text();
        const matches = html.match(emailRegex);
        if (matches && matches.length > 0) {
          return matches[0];
        }
      } catch {
        // Ignore individual URL errors
      }
    }

    return null;
  } catch {
    return null;
  }
}

// --- SAVE EXTERNAL VENDOR ---

function parseGermanAddress(address?: string | null) {
  if (!address) return { street: null, zip: null, city: null };

  const parts = address.split(',').map((p) => p.trim());
  const street = parts[0] || null;

  let zip: string | null = null;
  let city: string | null = null;

  if (parts.length >= 2) {
    const m = parts[1].match(/(\d{4,5})\s+(.+)/);
    if (m) {
      zip = m[1];
      city = m[2];
    } else {
      city = parts[1];
    }
  }

  return { street, zip, city };
}

export async function saveChosenExternalVendorAction(ticketId: string, vendor: ExternalVendor) {
  try {
    const { street, zip, city } = parseGermanAddress(vendor.address);

    const { data, error } = await supabaseAdmin
      .from('tickets')
      .update({
        chosen_tgm: vendor.name,
        tgm_street: street,
        tgm_city: city,
        tgm_zip: zip,
        tgm_mail: vendor.email ?? null,
        tgm_phone: vendor.phone ?? null,
        odoo_vendor_id: null, // Reset when choosing external vendor
      })
      .eq('id', ticketId)
      .select('*')
      .single();

    if (error) {
      console.error('[saveChosenExternalVendorAction] Supabase error', error);
      return { success: false, error: 'SUPABASE_UPDATE_ERROR' };
    }

    return { success: true, ticket: data };
  } catch (err) {
    console.error('[saveChosenExternalVendorAction] error', err);
    return { success: false, error: 'UNKNOWN_ERROR' };
  }
}

// --- IMPORT VENDOR TO ODOO ---

export async function importChosenVendorToOdooAction(ticketId: string) {
  try {
    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .select('id, chosen_tgm, tgm_street, tgm_city, tgm_zip, tgm_mail, tgm_phone, asset_id, odoo_vendor_id')
      .eq('id', ticketId)
      .single();

    if (error || !ticket) {
      console.error('[importChosenVendorToOdooAction] Ticket not found', error);
      return { success: false, error: 'TICKET_NOT_FOUND' };
    }

    if (!ticket.chosen_tgm) {
      return { success: false, error: 'NO_VENDOR_SELECTED' };
    }

    // Check if already exists in Odoo
    const vid = ticket.odoo_vendor_id;
    if (typeof vid === 'number' && vid > 0) {
      const exists = await partnerExistsInOdoo(vid);

      if (exists) {
        return { success: true, alreadyImported: true, partnerId: vid };
      }

      // Phantom ID - clear it
      await supabaseAdmin
        .from('tickets')
        .update({ odoo_vendor_id: null })
        .eq('id', ticketId);
    }

    // Create partner in Odoo
    const partnerId = await createServiceProviderInOdoo({
      name: ticket.chosen_tgm,
      street: ticket.tgm_street,
      zip: ticket.tgm_zip,
      city: ticket.tgm_city,
      email: ticket.tgm_mail,
      phone: ticket.tgm_phone,
      assetId: ticket.asset_id,
    });

    // Save Odoo ID
    await supabaseAdmin
      .from('tickets')
      .update({ odoo_vendor_id: partnerId })
      .eq('id', ticketId);

    return { success: true, partnerId, alreadyImported: false };
  } catch (err) {
    console.error('[importChosenVendorToOdooAction] error', err);
    return { success: false, error: 'ODOO_IMPORT_ERROR' };
  }
}

// --- RESET ODOO VENDOR ID ---

export async function resetOdooVendorIdAction(ticketId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('tickets')
      .update({ odoo_vendor_id: null })
      .eq('id', ticketId);

    if (error) {
      console.error('[resetOdooVendorIdAction] Supabase error', error);
      return { success: false, error: 'SUPABASE_RESET_ERROR' };
    }

    return { success: true };
  } catch (err) {
    console.error('[resetOdooVendorIdAction] error', err);
    return { success: false, error: 'UNKNOWN_ERROR' };
  }
}
