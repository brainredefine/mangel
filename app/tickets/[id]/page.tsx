// app/tickets/[id]/page.tsx

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTicketData } from './hooks/useTicketData';
import { prepareOfferMailAction } from './actions';
import { buildSignedPhotoLinksText, buildMailtoHref } from './mail/mail';
import { buildInquiryMail } from './mail/mailInquiry';

import { Card, Button, Spinner, cn } from '@/components/ui';
import { assetGroupFromRef } from '../../../lib/ticketMetrics';
import {
  TicketHeader,
  BuildingInfoCard,
  AdminControls,
  ChecklistSection,
  AttachmentsPanel,
  AdminNotesPanel,
  ActivityTimeline,
  TenantMessagePanel,
  CostSection,
  VendorStatusPanel,
  VendorOdooSection,
  VendorExternalSection,
} from './components';

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params?.id as string;

  const {
    profile,
    currentUserId,
    isAdminAm,
    ticket,
    attachments,
    buildingInfo,
    loadingBuildingInfo,
    loading,
    errorMsg,
    setTicket,
    setAttachments,
  } = useTicketData(ticketId);

  // Determine ticket type
  const isDefect = ticket?.ticket_type !== 'request';
  const isRequest = ticket?.ticket_type === 'request';
  const assetGroup = assetGroupFromRef(buildingInfo?.property_reference);

  // Tabs — split the long single column into scannable sections so nothing
  // is lost in a wall of stacked cards.
  const [activeTab, setActiveTab] = useState('overview');
  const [preparingOffer, setPreparingOffer] = useState(false);
  const tabs = [
    { key: 'overview' as const, label: 'Übersicht' },
    ...(isAdminAm ? [{ key: 'processing' as const, label: 'Bearbeitung' }] : []),
    ...(isAdminAm && isDefect ? [{ key: 'vendors' as const, label: 'Dienstleister' }] : []),
    { key: 'attachments' as const, label: 'Anhänge' },
    ...(isAdminAm ? [{ key: 'notes' as const, label: 'Notizen' }] : []),
    ...(isAdminAm ? [{ key: 'activity' as const, label: 'Verlauf' }] : []),
  ];

  // --- MAIL HANDLERS ---

  const handlePrepareInquiryMail = async (vendorName: string, email: string | null | undefined) => {
    if (!email) {
      alert('Keine E-Mail-Adresse für diesen Dienstleister hinterlegt.');
      return;
    }
    if (!ticket) return;

    try {
      const photoLinksText = await buildSignedPhotoLinksText(attachments, { excludePrivate: true });
      const costRows = Array.isArray(ticket.cost_table) ? ticket.cost_table : [];

      const mail = buildInquiryMail({
        ticket,
        buildingInfo: buildingInfo as any ?? null,
        vendorEmail: email,
        vendorName,
        photoLinksText,
        costRows,
      });

      window.location.href = buildMailtoHref(mail);
    } catch (err) {
      console.error(err);
      alert('Fehler beim Vorbereiten der E-Mail.');
    }
  };

  const handlePrepareOfferMail = async (vendorName: string, email?: string | null) => {
    if (preparingOffer) return;
    if (!email) {
      alert('Keine E-Mail-Adresse vorhanden.');
      return;
    }
    if (!ticket) return;

    setPreparingOffer(true);
    try {
      const res = await prepareOfferMailAction(ticket.id, vendorName, email);
      if (!res.success) {
        alert(`Fehler: ${res.error}`);
        return;
      }

      // Versand der Beauftragung markiert den Dienstleister als beauftragt.
      if (res.vendorStatus) {
        setTicket((prev) =>
          prev
            ? { ...prev, vendor_status: res.vendorStatus, beauftragt_at: res.beauftragtAt ?? prev.beauftragt_at }
            : prev
        );
      }

      // 1) Download the PDF so it can be attached to the mail.
      const bytes = Uint8Array.from(atob(res.pdfBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.pdfFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      // 2) Open the prefilled draft in the admin's own mail client (the body
      // sits above their signature). Small delay so the download isn't aborted.
      const mailto = `mailto:${encodeURIComponent(res.to)}?subject=${encodeURIComponent(
        res.subject
      )}&body=${encodeURIComponent(res.body)}`;
      setTimeout(() => {
        window.location.href = mailto;
      }, 400);
    } catch (err) {
      console.error(err);
      alert('Fehler beim Vorbereiten der Beauftragung.');
    } finally {
      setPreparingOffer(false);
    }
  };

  // --- RENDER: Loading ---
  if (loading) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-zinc-50 p-6">
        <div className="flex flex-col items-center space-y-4">
          <Spinner className="h-8 w-8 text-indigo-500" />
          <p className="text-sm font-medium text-zinc-500">Ticket wird geladen...</p>
        </div>
      </main>
    );
  }

  // --- RENDER: Error ---
  if (errorMsg && !ticket) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl border border-red-200 bg-red-50">
            <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-zinc-900">Fehler</h3>
            <p className="mt-2 text-sm text-red-600">{errorMsg || 'Ticket nicht gefunden.'}</p>
          </div>
          <button
            onClick={() => router.push(isAdminAm ? '/backoffice/tickets' : '/tickets/track')}
            className="text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-500"
          >
            ← Zurück zur Liste
          </button>
        </div>
      </main>
    );
  }

  if (!ticket) return null;

  // --- RENDER: Main ---
  return (
    <main className="min-h-screen w-full bg-zinc-50">

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(isAdminAm ? '/backoffice/tickets' : '/tickets/track')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-zinc-900">Ticket</h1>
                {isRequest && (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
                    Anfrage
                  </span>
                )}
                {isDefect && (
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
                    Mangel
                  </span>
                )}
              </div>
              <p className="max-w-[300px] truncate text-xs font-medium text-zinc-500">{ticket.title}</p>
            </div>
          </div>

          {isAdminAm && (
            <Button onClick={() => router.push('/backoffice/tickets')} size="sm">
              Backoffice
            </Button>
          )}
        </div>

        {/* Tab bar */}
        <div className="mx-auto max-w-5xl px-6">
          <nav className="-mb-px flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  'relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors',
                  activeTab === t.key ? 'text-indigo-600' : 'text-zinc-500 hover:text-zinc-900'
                )}
              >
                {t.label}
                {activeTab === t.key && (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-indigo-600" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">

        {activeTab === 'overview' && (
          <>
            <BuildingInfoCard
              buildingInfo={buildingInfo}
              loading={loadingBuildingInfo}
              isAdminAm={isAdminAm}
              odooTenancyId={ticket.odoo_tenancy_id}
            />
            <TicketHeader ticket={ticket} isAdminAm={isAdminAm} />
          </>
        )}

        {activeTab === 'processing' && isAdminAm && (
          <>
            <Card className="p-6">
              <AdminControls ticket={ticket} setTicket={setTicket} isRequest={isRequest} />
            </Card>
            <TenantMessagePanel ticket={ticket} setTicket={setTicket} />
            {isDefect && (
              <>
                <ChecklistSection ticket={ticket} setTicket={setTicket} />
                <CostSection ticket={ticket} setTicket={setTicket} />
              </>
            )}
          </>
        )}

        {activeTab === 'vendors' && isAdminAm && isDefect && (
          <>
            <VendorStatusPanel ticket={ticket} setTicket={setTicket} />
            <VendorOdooSection
              ticket={ticket}
              setTicket={setTicket}
              buildingInfo={buildingInfo}
              attachments={attachments}
              onPrepareInquiryMail={handlePrepareInquiryMail}
              onPrepareOfferMail={handlePrepareOfferMail}
            />
            <VendorExternalSection
              ticket={ticket}
              setTicket={setTicket}
              buildingInfo={buildingInfo}
              onPrepareInquiryMail={handlePrepareInquiryMail}
              onPrepareOfferMail={handlePrepareOfferMail}
            />
          </>
        )}

        {activeTab === 'attachments' && (
          <AttachmentsPanel
            ticketId={ticketId}
            tenantId={ticket.tenant_id}
            attachments={attachments}
            setAttachments={setAttachments}
            currentUserId={currentUserId}
            isAdminAm={isAdminAm}
          />
        )}

        {activeTab === 'notes' && isAdminAm && (
          <AdminNotesPanel ticket={ticket} setTicket={setTicket} />
        )}

        {activeTab === 'activity' && isAdminAm && (
          <ActivityTimeline ticketId={ticketId} />
        )}

      </div>
    </main>
  );
}