// lib/assetManagers.ts
//
// Asset-Manager-Zuordnung anhand der Odoo-Objektreferenz: AD* → Andrea,
// AC* → Nadine. SERVER ONLY (ruft Odoo).

import { fetchBuildingInfoByTenancy } from './odooClient';
import { assetGroupFromRef } from './ticketMetrics';

export const ASSET_MANAGERS: Record<'AD' | 'AC', { name: string; email: string }> = {
  AD: { name: 'Andrea Goldhahn', email: 'goldhahn@redefine.group' },
  AC: { name: 'Nadine Köhler', email: 'koehler@redefine.group' },
};

export async function resolveAssetManager(
  tenancyId: number | null | undefined
): Promise<{ name: string; email: string } | null> {
  if (!tenancyId) return null;
  try {
    const info = await fetchBuildingInfoByTenancy(Number(tenancyId));
    const group = assetGroupFromRef(info?.property_reference);
    return group ? ASSET_MANAGERS[group] : null;
  } catch (e) {
    console.warn('[assetManagers] Auflösung fehlgeschlagen', e);
    return null;
  }
}
