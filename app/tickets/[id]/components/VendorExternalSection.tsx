// app/tickets/[id]/components/VendorExternalSection.tsx

'use client';

import { useState, useEffect } from 'react';
import {
  searchExternalVendorsAction,
  saveChosenExternalVendorAction,
  importChosenVendorToOdooAction,
  resetOdooVendorIdAction,
} from '../actions';
import { Card, Button, Spinner, cn } from '@/components/ui';
import type { TicketWithMeta, ExternalVendor, BuildingInfo } from '../types';

type Props = {
  ticket: TicketWithMeta;
  setTicket: React.Dispatch<React.SetStateAction<TicketWithMeta | null>>;
  buildingInfo: BuildingInfo | null;
  onPrepareInquiryMail: (vendorName: string, email: string | null) => void;
  onPrepareOfferMail: (vendorName: string, email: string | null) => void;
};

export function VendorExternalSection({
  ticket,
  setTicket,
  buildingInfo,
  onPrepareInquiryMail,
  onPrepareOfferMail,
}: Props) {
  const [prompt, setPrompt] = useState('');
  const [vendors, setVendors] = useState<ExternalVendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (prompt.length > 3) return;
    if (!buildingInfo) return;

    const desc = (ticket.description || '').toLowerCase();

    let category = 'Handwerker';
    if (desc.includes('aufzug')) category = 'Aufzugsservice';
    else if (desc.includes('wasser') || desc.includes('rohr') || desc.includes('leck')) category = 'Sanitär Notdienst';
    else if (desc.includes('strom') || desc.includes('elektro')) category = 'Elektriker';
    else if (desc.includes('heizung') || desc.includes('wärme')) category = 'Heizungsservice';

    const city = buildingInfo.property_city || '';
    const zip = buildingInfo.property_zip || '';
    const query = `${category} ${city} ${zip}`.trim();

    setPrompt(query);
  }, [ticket.description, buildingInfo, prompt]);

  const handleSearch = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setLoaded(true);

    try {
      const res = await searchExternalVendorsAction(prompt.trim());
      if (res.success) {
        setVendors((res.data || []) as ExternalVendor[]);
      } else {
        console.error('External search error', res.error);
        alert('Externe Suche fehlgeschlagen.');
      }
    } catch (err) {
      console.error('handleSearch error', err);
      alert('Fehler bei der Suche.');
    } finally {
      setLoading(false);
    }
  };

  const handleChoose = async (vendor: ExternalVendor) => {
    const confirmMsg = `"${vendor.name}" als Dienstleister auswählen?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await saveChosenExternalVendorAction(ticket.id, vendor);
      if (!res.success) {
        console.error('Save error', res.error);
        alert('Fehler beim Speichern.');
        return;
      }
      setTicket(res.ticket as TicketWithMeta);
    } catch (err) {
      console.error('handleChoose error', err);
      alert('Unerwarteter Fehler.');
    }
  };

  const handleImportToOdoo = async () => {
    setImporting(true);

    try {
      await resetOdooVendorIdAction(ticket.id);
      const res = await importChosenVendorToOdooAction(ticket.id);

      if (!res.success) {
        alert(`Import Fehler: ${res.error}`);
      } else if (res.alreadyImported) {
        alert('Dieser Dienstleister existiert bereits in Odoo.');
      } else {
        alert('Import nach Odoo erfolgreich!');
      }
    } catch (err) {
      console.error('Import error', err);
      alert('Unerwarteter Fehler beim Import.');
    }

    setImporting(false);
  };

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <svg className="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Externe Dienstleister (Web &amp; KI)
            </h2>
          </div>
          <p className="max-w-md text-xs font-medium text-zinc-500">
            Online-Suche nach lokalen Dienstleistern (Google). Ergebnisse bitte vor Auftragsvergabe prüfen.
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-6 flex gap-3">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="z.B. Elektriker Berlin 10115"
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 transition-all placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <Button onClick={handleSearch} loading={loading} disabled={loading || !prompt.trim()}>
          {!loading && (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          )}
          Suchen
        </Button>
      </div>

      {/* Import to Odoo Button */}
      {ticket.chosen_tgm && !ticket.odoo_vendor_id && (
        <div className="mb-6 flex flex-col justify-between gap-4 border-l-2 border-indigo-500 bg-indigo-50 p-5 md:flex-row md:items-center">
          <div>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Ausgewählt</span>
            <span className="font-semibold text-zinc-900">{ticket.chosen_tgm}</span>
            <span className="mt-1 block text-xs font-medium text-zinc-500">Noch nicht in Odoo importiert</span>
          </div>
          <Button
            onClick={handleImportToOdoo}
            loading={importing}
            className="bg-indigo-600 hover:bg-indigo-500"
          >
            Nach Odoo importieren
          </Button>
        </div>
      )}

      {/* Results */}
      {loaded && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-3 py-8">
              <Spinner className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-medium text-zinc-500">Durchsuche Google Places...</span>
            </div>
          ) : vendors.length === 0 ? (
            <div className="py-12 text-center">
              <svg className="mx-auto mb-4 h-12 w-12 text-zinc-200" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <p className="text-sm font-medium text-zinc-500">Keine Ergebnisse gefunden</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {vendors.map((vendor) => (
                <ExternalVendorCard
                  key={vendor.id}
                  vendor={vendor}
                  isChosen={ticket.chosen_tgm === vendor.name}
                  onChoose={() => handleChoose(vendor)}
                  onInquiryMail={() => onPrepareInquiryMail(vendor.name, vendor.email ?? null)}
                  onOfferMail={() => onPrepareOfferMail(vendor.name, vendor.email ?? null)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ExternalVendorCard({
  vendor,
  isChosen,
  onChoose,
  onInquiryMail,
  onOfferMail,
}: {
  vendor: ExternalVendor;
  isChosen: boolean;
  onChoose: () => void;
  onInquiryMail: () => void;
  onOfferMail: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border-l-2 p-5 transition-all',
        isChosen
          ? 'border-indigo-500 bg-indigo-50'
          : 'border-zinc-200 bg-zinc-50 hover:border-indigo-400'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold text-zinc-900">{vendor.name}</h4>

          {/* Rating */}
          {vendor.rating && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={cn('h-3 w-3', i < Math.round(vendor.rating!) ? 'text-amber-400' : 'text-zinc-200')}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-xs font-bold text-zinc-900">{vendor.rating.toFixed(1)}</span>
              {vendor.reviewCount && (
                <span className="text-[10px] font-medium text-zinc-400">({vendor.reviewCount})</span>
              )}
            </div>
          )}

          {isChosen && (
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ausgewählt
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Button onClick={onChoose} size="sm">
            Auswählen
          </Button>

          {vendor.email && (
            <>
              <Button onClick={onInquiryMail} variant="secondary" size="sm">
                Anfrage
              </Button>
              <Button onClick={onOfferMail} variant="secondary" size="sm">
                Beauftragung
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Contact Info */}
      <div className="mt-4 space-y-2 text-xs font-medium text-zinc-600">
        {vendor.address && (
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="font-mono text-[11px]">{vendor.address}</span>
          </div>
        )}
        {vendor.phone && (
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            <span className="font-mono">{vendor.phone}</span>
          </div>
        )}
        {vendor.email && (
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <a href={`mailto:${vendor.email}`} className="text-indigo-600 hover:underline">
              {vendor.email}
            </a>
          </div>
        )}
        {vendor.website && (
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            <a href={vendor.website} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
              Website
            </a>
          </div>
        )}
        {vendor.sourceUrl && (
          <a
            href={vendor.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 transition-colors hover:text-indigo-600"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Google Maps
          </a>
        )}
      </div>
    </div>
  );
}
