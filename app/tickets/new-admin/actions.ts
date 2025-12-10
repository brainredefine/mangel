'use server';

import { fetchAllTenanciesFromOdoo } from '../../../lib/odooClient';

const ALLOWED_ENTITY_IDS: number[] = [
  // optionnel: 12, 34, ...
];

export async function getAdminTenanciesAction() {
  try {
    const raw = await fetchAllTenanciesFromOdoo({ limit: 5000 });

    // 0) ✅ Exclure les "Vacant"
    const withoutVacant = (raw || []).filter((t: any) => {
      const name = String(t.name || t.display_name || '').toLowerCase();
      return !name.includes('vacant');
    });

    // 1) ✅ Filtre Eagle / Fund IV (via company du building)
    const filteredByCompany = withoutVacant.filter((t: any) => {
      const company = t.property_company || '';
      return company.includes('Eagle') || company.includes('Fund IV');
    });

    // 2) ✅ Filtre entity_id (si utilisé)
    const filtered = filteredByCompany.filter((t: any) => {
      if (!ALLOWED_ENTITY_IDS.length) return true;
      const eid = t.property_entity_id;
      return eid && ALLOWED_ENTITY_IDS.includes(Number(eid));
    });

    // 3) Formatage
    const formatted = filtered.map((t: any) => {
      const address = [t.property_street, t.property_zip, t.property_city].filter(Boolean).join(', ');
      const tenancyName = (t.name || t.display_name || String(t.id)).trim();

      const tenancyId = Number(t.id);
      const partnerId = t.tenant_partner_id ? Number(t.tenant_partner_id) : null;

      const label = `${tenancyName}${address ? ` - ${address}` : ''} | Tenancy #${tenancyId}${
        partnerId ? ` | Partner #${partnerId}` : ''
      }`;

      return {
        id: tenancyId,
        label,
        fullDetails: label,
        asset_id: t.asset_id ?? null,
        tenant_partner_id: partnerId,
        tenant_partner_name: t.tenant_partner_name ?? null,
        entity_id: t.property_entity_id ?? null,
        entity_name: t.property_entity_name ?? null,
        property_company: t.property_company ?? null,
      };
    });

    formatted.sort((a: any, b: any) => String(a.label).localeCompare(String(b.label), 'de'));

    return { success: true, data: formatted };
  } catch (error: any) {
    console.error('❌ getAdminTenanciesAction error:', error);
    return { success: false, error: 'Impossible de récupérer les tenancies (admin).' };
  }
}
