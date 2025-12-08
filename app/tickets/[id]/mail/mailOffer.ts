// app/tickets/[id]/mail/mailOffer.ts
type OfferMailParams = {
  vendorEmail: string;
  vendorName: string;

  description: string;

  ownerEntityName?: string | null;
  ownerEntityAddress?: string | null;
  ownerEntityVat?: string | null;

  tenantName?: string | null;
  tenantAddress?: string | null;
  tenantEmail?: string | null;
  tenantPhone?: string | null;

  beauftragungsummeBrutto?: number | null;
  dueDateText?: string | null;

  invoiceMailbox?: string | null; // ✅ NEW
};

export function buildOfferMail(p: OfferMailParams) {
  const subjectRaw = `Beauftragung – ${p.description}`.trim();

  const ownerName = p.ownerEntityName || '—';
  const ownerAddr = p.ownerEntityAddress || '—';
  const ownerVat = p.ownerEntityVat || '—';

  const tenantLineParts = [
    p.tenantName ? `Herr/Frau ${p.tenantName}` : null,
    p.tenantPhone ? `Tel.: ${p.tenantPhone}` : null,
    p.tenantEmail ? `E-Mail: ${p.tenantEmail}` : null,
  ].filter(Boolean);

  const tenantBlock = tenantLineParts.length ? tenantLineParts.join(', ') : '—';

  const brutto =
    typeof p.beauftragungsummeBrutto === 'number' ? p.beauftragungsummeBrutto : null;
  const netto = brutto !== null ? brutto / 1.19 : null;

  const fmt = (n: number) =>
    n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const bruttoText = brutto !== null ? fmt(brutto) : '—';
  const nettoText = netto !== null ? fmt(netto) : '—';

  const dueText = p.dueDateText || 'schnellstmöglich, wie besprochen';

  const invoiceMailbox = p.invoiceMailbox || 'inv@redefine.group';

  const body = `Sehr geehrte Damen und Herren,

namens und im Auftrag der Eigentümerin, ${ownerName}, möchten wir Sie gerne mit den nachstehenden Arbeiten beauftragen.

Beschreibung: ${p.description}

Kontaktdaten: ${tenantBlock}
Adresse (Mieter): ${p.tenantAddress || '—'}

Ausführung: ${dueText}
Beauftragungsumme: EUR ${bruttoText} brutto (entspricht ca. EUR ${nettoText} netto zzgl. MwSt.)


Bitte beachten Sie bei der Rechnungsstellung die Angabe des richtigen Rechnungsempfängers wie folgt:

Rechnungsempfänger:

${ownerName}
c/o REDEFINE Asset Management GmbH
Kantstraße 149
10623 Berlin

Bitte vermerken Sie ebenfalls unbedingt den Leistungsempfänger auf Ihrer Rechnung:

${ownerName}
${ownerAddr}
Steuernummer: ${ownerVat}

Bitte senden Sie uns die Leistungsnachweise, inklusive der vom Mieter unterzeichneten Stundenzettel, sowie die Rechnung bei Möglichkeit direkt an das Postfach ${invoiceMailbox} um die schnellstmögliche Bearbeitung zu gewährleisten.

Vielen Dank für Ihre Mühe bereits im Voraus. Wir freuen uns auf eine gute Zusammenarbeit.
`;

  return {
    to: p.vendorEmail,
    subject: subjectRaw,
    body,
  };
}
