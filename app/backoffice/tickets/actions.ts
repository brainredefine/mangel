'use server';

import { fetchTenanciesNamesByIds } from '../../../lib/odooClient';

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