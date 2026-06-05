// /app/backoffice/tickets/actions.ts

'use server';

import { fetchTenanciesNamesByIds, fetchPartnerNamesByIds } from '../../../lib/odooClient';

export async function getTenancyNamesAction(ids: number[]) {
  console.log("🚀 [ServerAction] getTenancyNamesAction started for IDs:", ids);
  
  try {
    const data = await fetchTenanciesNamesByIds(ids);
    console.log("🏁 [ServerAction] Success. Data keys:", Object.keys(data));
    return { success: true, data };
  } catch (error) {
    console.error("💥 [ServerAction] Error fetching Odoo names:", error);
    return { success: false, error: 'Failed to fetch Odoo data' };
  }
}

export async function getPartnerNamesAction(ids: number[]) {
  console.log("🚀 [ServerAction] getPartnerNamesAction started for IDs:", ids);
  
  try {
    const data = await fetchPartnerNamesByIds(ids);
    console.log("🏁 [ServerAction] Success. Partner names:", Object.keys(data).length);
    return { success: true, data };
  } catch (error) {
    console.error("💥 [ServerAction] Error fetching partner names:", error);
    return { success: false, error: 'Failed to fetch partner names' };
  }
}