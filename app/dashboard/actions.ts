// /app/dashboard/actions.ts

'use server';

import { fetchPartnerProfile } from '../../lib/odooClient';

export async function getPartnerProfileAction(partnerId: number) {
  console.log("🚀 [ServerAction] getPartnerProfileAction for partner:", partnerId);
  
  try {
    const data = await fetchPartnerProfile(partnerId);
    console.log("📦 [ServerAction] Data received:", JSON.stringify(data));
    return { success: true, data };
  } catch (error) {
    console.error("💥 [ServerAction] Error fetching partner profile:", error);
    return { success: false, error: 'Failed to fetch partner profile' };
  }
}