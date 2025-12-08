// app/tickets/[id]/actions.ts
'use server';

import {
  fetchBuildingInfoByTenancy,
  fetchVendorsByReference,
  createServiceProviderInOdoo,
  partnerExistsInOdoo,
  fetchOfferMailContext, // ✅ NEW
} from '../../../lib/odooClient';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

// Si tu veux garder le typage aligné avec page.tsx :
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

export async function getOfferMailContextAction(tenancyId: number, tenantPartnerId: number) {
  try {
    const data = await fetchOfferMailContext({ tenancyId, tenantPartnerId });
    return { success: true, data };
  } catch (e: any) {
    console.error('[getOfferMailContextAction] error', e);
    return { success: false, error: e?.message ?? 'Unknown error' };
  }
}


export async function getBuildingInfoAction(tenancyId: number | string) {
  try {
    const id = Number(tenancyId);

    console.log(
      '[getBuildingInfoAction] raw tenancyId from client =',
      tenancyId,
      '-> parsed =',
      id
    );

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

export async function getRecommendedVendorsAction(tenancyId: number) {
  try {
    const buildingData = await fetchBuildingInfoByTenancy(tenancyId);

    if (!buildingData) {
      console.warn(
        '[getRecommendedVendorsAction] Aucun buildingData pour tenancyId =',
        tenancyId
      );
      return { success: false, error: 'NO_BUILDING_DATA' };
    }

    const internalLabel = (buildingData as any).property_internal_label;

    if (!internalLabel) {
      console.warn(
        '[getRecommendedVendorsAction] Pas de internal_label trouvé pour ce bâtiment (tenancyId =',
        tenancyId,
        ')'
      );
      return { success: false, error: 'NO_INTERNAL_LABEL' };
    }

    console.log(
      `Recherche prestataires Odoo avec catégories: 'Maintenance' + '${internalLabel}'`
    );

    const vendors = await fetchVendorsByReference(internalLabel);

    return { success: true, data: vendors };
  } catch (err) {
    console.error('getRecommendedVendorsAction error', err);
    return { success: false, error: 'ODOO_VENDOR_ERROR' };
  }
}

/**
 * Recherche de prestataires externes via Google Places Text Search.
 */
export async function searchExternalVendorsAction(searchPrompt: string) {
  try {
    const prompt = searchPrompt?.trim();
    if (!prompt) {
      return { success: false, error: 'EMPTY_PROMPT' };
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('[searchExternalVendorsAction] Missing GOOGLE_PLACES_API_KEY');
      return { success: false, error: 'NO_GOOGLE_KEY' };
    }

    const MAX_QUERY_LEN = 512;
    const query = prompt.slice(0, MAX_QUERY_LEN);

    console.log('[searchExternalVendorsAction] query =', query);

    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&language=de&region=de&key=${apiKey}`;

    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      const text = await searchResponse.text();
      console.error(
        '[searchExternalVendorsAction] Google Places HTTP error (search)',
        searchResponse.status,
        text
      );
      return { success: false, error: 'GOOGLE_PLACES_HTTP_ERROR' };
    }

    const searchJson = (await searchResponse.json()) as any;

    console.log(
      '[searchExternalVendorsAction] Google Places SEARCH status =',
      searchJson.status
    );

    if (searchJson.status !== 'OK' && searchJson.status !== 'ZERO_RESULTS') {
      console.error(
        '[searchExternalVendorsAction] Google Places SEARCH non-OK status:',
        searchJson.status,
        searchJson.error_message
      );
      return {
        success: false,
        error: searchJson.status || 'GOOGLE_PLACES_SEARCH_ERROR',
      };
    }

    const results = Array.isArray(searchJson.results) ? searchJson.results : [];

    if (!results.length) {
      return { success: true, data: [], usedPrompt: query };
    }

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
      let mapsUrl: string | null =
        placeId ? `https://www.google.com/maps/place/?q=place_id:${placeId}` : null;

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
            } else {
              console.warn(
                '[searchExternalVendorsAction] Details status not OK for placeId',
                placeId,
                detailsJson.status,
                detailsJson.error_message
              );
            }
          } else {
            console.warn(
              '[searchExternalVendorsAction] Details HTTP error for placeId',
              placeId,
              detailsResponse.status
            );
          }
        } catch (detailsErr) {
          console.error(
            '[searchExternalVendorsAction] Details fetch error for placeId',
            placeId,
            detailsErr
          );
        }
      }

      if (website) {
        try {
          email = await extractEmailFromWebsite(website);
        } catch (scrapeErr) {
          console.error(
            '[searchExternalVendorsAction] Error scraping email for website',
            website,
            scrapeErr
          );
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

// Petit helper pour essayer d'extraire un email depuis un site web
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
          const email = matches[0];
          console.log('[extractEmailFromWebsite] Found email', email, 'on', url);
          return email;
        }
      } catch (err) {
        console.warn('[extractEmailFromWebsite] Error fetching', url, err);
      }
    }

    return null;
  } catch (err) {
    console.error('[extractEmailFromWebsite] global error', err);
    return null;
  }
}

function parseGermanAddress(address?: string | null) {
  if (!address) {
    return { street: null as string | null, zip: null as string | null, city: null as string | null };
  }

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

        // ✅ reset propre quand on passe en externe
        odoo_vendor_id: null,
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

export async function importChosenVendorToOdooAction(ticketId: string) {
  try {
    // 1. Récupérer le ticket avec les infos TGM
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

    // 1bis. Si un odoo_vendor_id est présent, on vérifie qu'il existe vraiment dans Odoo
    const vid = ticket.odoo_vendor_id;
    if (typeof vid === 'number' && vid > 0) {
      const exists = await partnerExistsInOdoo(vid);

      if (exists) {
        return { success: true, alreadyImported: true, partnerId: vid };
      }

      // ID fantôme -> on clear pour forcer la recréation
      const { error: clearErr } = await supabaseAdmin
        .from('tickets')
        .update({ odoo_vendor_id: null })
        .eq('id', ticketId);

      if (clearErr) {
        console.error('[importChosenVendorToOdooAction] Failed to clear phantom odoo_vendor_id', clearErr);
        // On continue quand même : pas bloquant
      }
    }

    // 2. Créer le partenaire dans Odoo
    const partnerId = await createServiceProviderInOdoo({
      name: ticket.chosen_tgm,
      street: ticket.tgm_street,
      zip: ticket.tgm_zip,
      city: ticket.tgm_city,
      email: ticket.tgm_mail,
      phone: ticket.tgm_phone,
      assetId: ticket.asset_id,
    });

    // 3. Sauver l'ID Odoo dans le ticket
    const { error: updateError } = await supabaseAdmin
      .from('tickets')
      .update({ odoo_vendor_id: partnerId })
      .eq('id', ticketId);

    if (updateError) {
      console.error('[importChosenVendorToOdooAction] Error updating ticket', updateError);
    }

    return { success: true, partnerId, alreadyImported: false };
  } catch (err) {
    console.error('[importChosenVendorToOdooAction] error', err);
    return { success: false, error: 'ODOO_IMPORT_ERROR' };
  }
}

export async function resetOdooVendorIdAction(ticketId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('tickets')
      .update({ odoo_vendor_id: 0 }) // 👈 comme tu le veux, littéralement 0
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
