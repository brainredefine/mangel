// app/tickets/[id]/components/VendorOdooSection.tsx

'use client';

import { useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { getRecommendedVendorsAction } from '../actions';
import { buildVendorAddress, getVendorEmail, getVendorPhone } from '../utils';
import { Card, Button, Spinner, cn } from '@/components/ui';
import type { TicketWithMeta, OdooVendor, AttachmentWithUrl } from '../types';

type Props = {
  ticket: TicketWithMeta;
  setTicket: React.Dispatch<React.SetStateAction<TicketWithMeta | null>>;
  buildingInfo: any | null;
  attachments: AttachmentWithUrl[];
  onPrepareInquiryMail: (vendorName: string, email: string | null) => void;
  onPrepareOfferMail: (vendorName: string, email: string | null) => void;
};

export function VendorOdooSection({
  ticket,
  setTicket,
  buildingInfo,
  attachments,
  onPrepareInquiryMail,
  onPrepareOfferMail,
}: Props) {
  const [vendors, setVendors] = useState<OdooVendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleLoad = async () => {
    if (!ticket.odoo_tenancy_id) return;

    setLoading(true);
    setLoaded(true);

    const res = await getRecommendedVendorsAction(ticket.odoo_tenancy_id);
    if (res.success) {
      setVendors(res.data as OdooVendor[]);
    } else {
      console.error(res.error);
    }

    setLoading(false);
  };

  const handleChoose = async (vendor: OdooVendor) => {
    const confirmMsg = `"${vendor.name}" als Dienstleister auswählen?`;
    if (!window.confirm(confirmMsg)) return;

    const street = typeof vendor.street === 'string' ? vendor.street : null;
    const zip = typeof vendor.zip === 'string' ? vendor.zip : null;
    const city = typeof vendor.city === 'string' ? vendor.city : null;
    const email = getVendorEmail(vendor);
    const phone = getVendorPhone(vendor);

    const { data, error } = await supabase
      .from('tickets')
      .update({
        chosen_tgm: vendor.name,
        tgm_street: street,
        tgm_city: city,
        tgm_zip: zip,
        tgm_mail: email,
        tgm_phone: phone,
        odoo_vendor_id: vendor.id,
      })
      .eq('id', ticket.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error setting vendor', error);
      alert('Fehler beim Speichern.');
      return;
    }

    setTicket((prev) => (prev ? { ...prev, ...(data as any) } : prev));
  };

  const handleCopy = (vendor: OdooVendor) => {
    const address = buildVendorAddress(vendor);
    const contact = [getVendorPhone(vendor), getVendorEmail(vendor)].filter(Boolean).join(' / ');
    const text = [vendor.name, address || null, contact || null].filter(Boolean).join(' — ');
    navigator.clipboard.writeText(text);
    alert('Kopiert!');
  };

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <svg className="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
            </svg>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Zugeordnete Dienstleister (Odoo)
            </h2>
          </div>

          {/* Chosen vendor indicator */}
          {ticket.chosen_tgm && (
            <div className="mt-3 inline-flex items-center gap-2 border-l-2 border-indigo-500 bg-indigo-50 px-4 py-2">
              <svg className="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">
                <span className="text-zinc-500">Ausgewählt:</span>{' '}
                <strong className="text-zinc-900">{ticket.chosen_tgm}</strong>
              </span>
            </div>
          )}
        </div>

        {!loaded && (
          <Button onClick={handleLoad}>Liste laden</Button>
        )}
      </div>

      {/* Results */}
      {loaded && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-3 py-8">
              <Spinner className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-medium text-zinc-500">Suche nach Dienstleistern...</span>
            </div>
          ) : vendors.length === 0 ? (
            <div className="py-12 text-center">
              <svg className="mx-auto mb-4 h-12 w-12 text-zinc-200" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm font-medium text-zinc-500">Keine Dienstleister mit dem Gebäude-Tag gefunden</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {vendors.map((vendor) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  isChosen={ticket.chosen_tgm === vendor.name}
                  onChoose={() => handleChoose(vendor)}
                  onCopy={() => handleCopy(vendor)}
                  onInquiryMail={() => onPrepareInquiryMail(vendor.name, getVendorEmail(vendor))}
                  onOfferMail={() => onPrepareOfferMail(vendor.name, getVendorEmail(vendor))}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function VendorCard({
  vendor,
  isChosen,
  onChoose,
  onCopy,
  onInquiryMail,
  onOfferMail,
}: {
  vendor: OdooVendor;
  isChosen: boolean;
  onChoose: () => void;
  onCopy: () => void;
  onInquiryMail: () => void;
  onOfferMail: () => void;
}) {
  const email = getVendorEmail(vendor);
  const phone = getVendorPhone(vendor);
  const address = buildVendorAddress(vendor);

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
          <Button onClick={onCopy} variant="secondary" size="sm">
            Kopieren
          </Button>

          <Button onClick={onChoose} size="sm">
            Auswählen
          </Button>

          {email && (
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
        {address && (
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="font-mono text-[11px]">{address}</span>
          </div>
        )}
        {phone && (
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            <span className="font-mono">{phone}</span>
          </div>
        )}
        {email && (
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <a href={`mailto:${email}`} className="text-indigo-600 hover:underline">
              {email}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
