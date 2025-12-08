// app/tickets/[id]/mail/mailInquiry.ts

import type { Ticket } from '../types';

export type BuildingInfo = {
  objekt_label: string;
  property_reference?: string;
  property_internal_label?: string | null;
  property_street?: string;
  property_zip?: string;
  property_city?: string;
};

type CostRow = {
  label: string;
  kostengruppe: string;
};

export function buildInquiryMail(params: {
  ticket: Ticket;
  buildingInfo: BuildingInfo | null;
  vendorEmail: string;
  vendorName: string;
  photoLinksText: string;
  costRows: CostRow[];
}) {
  const { ticket, buildingInfo, vendorEmail, photoLinksText, costRows } = params;

  const subject = `Anfrage – ${ticket.title ?? ''} – ${buildingInfo?.objekt_label ?? ''}`.trim();

  const objekt =
    buildingInfo?.objekt_label ??
    buildingInfo?.property_internal_label ??
    buildingInfo?.property_reference ??
    '-';

  const address = [buildingInfo?.property_street, buildingInfo?.property_zip, buildingInfo?.property_city]
    .filter(Boolean)
    .join(' ');

  const lpLines =
    costRows.length > 0
      ? costRows
          .map((row, index) => {
            const lpNumber = index + 1;
            const label = row.label || 'Leistungsposition';
            const kg = row.kostengruppe || '';
            return `- LP ${lpNumber}: ${label}${kg ? ` (KG ${kg})` : ''}`;
          })
          .join('\n')
      : '- (keine Leistungspositionen vorhanden)';

  const body = `Sehr geehrte Damen und Herren,

wir bitten um ein Angebot bzw. die Durchführung der folgenden Maßnahme in einem Wohnobjekt.

Objekt: ${objekt}
Adresse: ${address || '-'}

Kurzbeschreibung des Problems:

${ticket.description || ''}

Auszuführende Leistungspositionen:

${lpLines}

Fotodokumentation (Links gültig für 7 Tage):

${photoLinksText}

Bitte prüfen Sie die Angaben und geben Sie uns eine kurze Rückmeldung zu Verfügbarkeit und weiterem Vorgehen.

Mit freundlichen Grüßen
Ihr REDEFINE Team
`;

  return { to: vendorEmail, subject, body };
}
