'use server';

import { fetchTenanciesFromOdoo } from '../../../lib/odooClient';

export async function getTenanciesAction(odooPartnerId: string) {
  if (!odooPartnerId) return { success: false, data: [] };

  try {
    const partnerIdInt = parseInt(odooPartnerId, 10);
    if (isNaN(partnerIdInt)) return { success: false, error: 'ID Odoo invalide' };

    const rawData = await fetchTenanciesFromOdoo(partnerIdInt);

    // 1. FILTRAGE : On garde la logique de sécurité (Eagle / Fund IV)
    const filteredData = rawData.filter((t: any) => {
      const company = t.property_company || '';
      return company.includes("Eagle") || company.includes("Fund IV");
    });

    // 2. FORMATAGE VISUEL : ID - Adresse
    const formatted = filteredData.map((t: any) => {
        
        // Construction de l'adresse propre (Rue, CP Ville)
        const addressParts = [t.property_street, t.property_zip, t.property_city]
            .filter(Boolean)
            .join(', '); // Ex: "Hauptstrasse 1, 10115 Berlin"

        // Format demandé : "ID - Adresse"
        // t.id est l'ID du contrat (tenancy)
        const label = `${t.id} - ${addressParts}`;

        return {
            id: t.id,
            label: label, 
            fullDetails: label, // Ce qui sera écrit dans le ticket
            asset_id: t.asset_id ?? null, 
        };
    });

    return { success: true, data: formatted };
  } catch (error: any) {
    console.error("❌ Erreur Odoo:", error);
    return { success: false, error: "Impossible de récupérer les propriétés." };
  }
}