// app/tickets/[id]/components/BuildingInfoCard.tsx

'use client';

import { isWarrantyPossible } from '../utils';
import { Spinner } from '@/components/ui';
import type { BuildingInfo } from '../types';

type Props = {
  buildingInfo: BuildingInfo | null;
  loading: boolean;
  isAdminAm: boolean;
  odooTenancyId: number | null;
};

export function BuildingInfoCard({ buildingInfo, loading, isAdminAm, odooTenancyId }: Props) {
  if (!isAdminAm && !buildingInfo) return null;

  return (
    <div className="border-l-2 border-indigo-500 bg-white py-3 pl-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <svg className="h-3.5 w-3.5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
        </svg>
        <h3 className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">
          Gebäudeinformationen {isAdminAm ? '(Odoo)' : ''}
        </h3>
      </div>

      {loading ? (
        <div className="flex items-center gap-2">
          <Spinner className="h-3 w-3 text-indigo-500" />
          <span className="text-xs font-medium text-zinc-500">Lade Daten...</span>
        </div>
      ) : buildingInfo ? (
        <BuildingDetails buildingInfo={buildingInfo} isAdminAm={isAdminAm} />
      ) : (
        <p className="text-xs font-medium text-zinc-500">
          Keine Daten <span className="text-[9px] text-zinc-400">(ID: {odooTenancyId})</span>
        </p>
      )}
    </div>
  );
}

function BuildingDetails({ buildingInfo, isAdminAm }: { buildingInfo: BuildingInfo; isAdminAm: boolean }) {
  const showWarrantyWarning = isAdminAm && isWarrantyPossible(buildingInfo.construction_year);

  return (
    <div className="space-y-2">
      {/* Object & Tenancy - inline */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <div>
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-400">Objekt</span>
          <p className="truncate font-medium text-zinc-900">{buildingInfo.objekt_label}</p>
        </div>
        <div>
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-400">Tenancy</span>
          <p className="text-zinc-700">
            <span className="font-mono text-[10px] text-indigo-600">{buildingInfo.tenancy_id}</span>
            <span className="mx-1 text-zinc-300">—</span>
            <span className="truncate">{buildingInfo.tenancy_name}</span>
          </p>
        </div>
        <div>
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-400">Baujahr</span>
          <p className="font-semibold text-zinc-900">{buildingInfo.construction_year || '—'}</p>
        </div>
        <div>
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-400">Modernisierung</span>
          <p className="font-semibold text-zinc-900">{buildingInfo.last_modernization || '—'}</p>
        </div>
      </div>

      {/* Warranty Warning */}
      {showWarrantyWarning && (
        <div className="mt-2 flex items-center gap-2 border-l-2 border-amber-500 bg-amber-50 px-3 py-2">
          <svg className="h-4 w-4 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-amber-700">
            Gewährleistung möglich (≤5 Jahre)
          </span>
        </div>
      )}
    </div>
  );
}
