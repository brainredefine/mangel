// lib/buildOfferPdf.ts
//
// Renders the vendor "Beauftragung" letter as a PDF. The body text is taken
// verbatim from buildOfferMail so the PDF and the e-mail stay in sync — this
// generator only adds letter styling (header band, recipient, bold headings).

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const COLORS = {
  primary: rgb(0.11, 0.2, 0.34), // Bleu nuit
  secondary: rgb(0.4, 0.4, 0.4),
  text: rgb(0.15, 0.15, 0.15),
  white: rgb(1, 1, 1),
};

function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

type OfferPdfParams = {
  subject: string;
  body: string;
  vendorName: string;
  beauftragungsNummer?: string | null;
};

export async function buildOfferPdf({ subject, body, vendorName, beauftragungsNummer }: OfferPdfParams): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage();
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const marginX = 55;
  const bottomMargin = 60;
  const contentWidth = width - marginX * 2;
  const lineHeight = 14;

  // Header band
  const headerHeight = 90;
  page.drawRectangle({
    x: 0,
    y: height - headerHeight,
    width,
    height: headerHeight,
    color: COLORS.primary,
  });
  page.drawText('BEAUFTRAGUNG', {
    x: marginX,
    y: height - 52,
    size: 18,
    font: fontBold,
    color: COLORS.white,
  });
  const dateStr = `Datum: ${new Date().toLocaleDateString('de-DE')}`;
  page.drawText(dateStr, {
    x: width - marginX - font.widthOfTextAtSize(dateStr, 10),
    y: height - 50,
    size: 10,
    font,
    color: rgb(0.8, 0.8, 0.9),
  });
  if (beauftragungsNummer) {
    const nrStr = `Nr.: ${beauftragungsNummer}`;
    page.drawText(nrStr, {
      x: width - marginX - font.widthOfTextAtSize(nrStr, 10),
      y: height - 66,
      size: 10,
      font,
      color: rgb(0.85, 0.85, 0.95),
    });
  }

  let y = height - headerHeight - 36;

  const ensureSpace = (needed: number) => {
    if (y - needed < bottomMargin) {
      page = pdfDoc.addPage();
      y = height - 60;
    }
  };

  // Recipient
  page.drawText('An:', { x: marginX, y, size: 9, font: fontBold, color: COLORS.secondary });
  y -= 14;
  page.drawText(vendorName, { x: marginX, y, size: 13, font: fontBold, color: COLORS.text });
  y -= 26;

  // Subject
  for (const line of wrapText(subject, contentWidth, fontBold, 12)) {
    ensureSpace(lineHeight);
    page.drawText(line, { x: marginX, y, size: 12, font: fontBold, color: COLORS.primary });
    y -= 16;
  }
  y -= 12;

  // Body — render verbatim, bold short heading lines (ending with ':')
  const bodyLines = body.split(/\r?\n/);
  for (const raw of bodyLines) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      y -= 8;
      continue;
    }
    const isHeading = line.trim().endsWith(':') && line.trim().length < 30;
    const usedFont = isHeading ? fontBold : font;
    for (const l of wrapText(line, contentWidth, usedFont, 10)) {
      ensureSpace(lineHeight);
      page.drawText(l, { x: marginX, y, size: 10, font: usedFont, color: COLORS.text });
      y -= lineHeight;
    }
  }

  // Footer on every page
  const footer = 'REDEFINE Asset Management GmbH · Kantstraße 149 · 10623 Berlin';
  for (const p of pdfDoc.getPages()) {
    p.drawText(footer, { x: marginX, y: 28, size: 8, font, color: rgb(0.6, 0.6, 0.6) });
  }

  return pdfDoc.save();
}
