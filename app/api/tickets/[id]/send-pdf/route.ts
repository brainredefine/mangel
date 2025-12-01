import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { PDFDocument, StandardFonts, rgb, Color } from 'pdf-lib';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CostRow = {
  id: string;
  label: string;
  kostengruppe: string;
  amount: number | null;
  notes?: string;
  rowType?: 'position' | 'subtotal' | 'extra' | 'total';
};

type Ticket = {
  id: string;
  title: string | null;
  cost_analysis_text: string | null;
  cost_table: CostRow[] | null;
  created_at: string;
};

// Couleurs de la charte graphique (Modern Blue)
const COLORS = {
  primary: rgb(0.11, 0.20, 0.34), // Bleu nuit #1c3357
  secondary: rgb(0.40, 0.40, 0.40), // Gris texte
  accent: rgb(0.96, 0.96, 0.97), // Fond gris très clair
  divider: rgb(0.85, 0.85, 0.85), // Lignes de séparation
  text: rgb(0.15, 0.15, 0.15), // Noir doux
  black: rgb(0, 0, 0), // Noir pur
};

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  } catch {
    return `${value} €`;
  }
}

function wrapText(
  text: string,
  maxWidth: number,
  font: any,
  fontSize: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const { id: ticketId } = await context.params;

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId manquant' }, { status: 400 });
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select('id, title, cost_analysis_text, cost_table, created_at')
      .eq('id', ticketId)
      .single<Ticket>();

    if (ticketError || !ticket) {
      console.error('ticketError', ticketError);
      return NextResponse.json(
        { error: 'Ticket introuvable pour PDF' },
        { status: 404 }
      );
    }

    const analysisText =
      ticket.cost_analysis_text ??
      'Keine Analyse vorhanden.';

    const rows: CostRow[] = Array.isArray(ticket.cost_table)
      ? ticket.cost_table
      : [];

    // --- CRÉATION DU PDF ---
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    let { width, height } = page.getSize();
    const marginX = 50;
    const bottomMargin = 60;
    
    // HEADER DESIGN (Bandeau Coloré)
    const headerHeight = 100;
    page.drawRectangle({
      x: 0,
      y: height - headerHeight,
      width: width,
      height: headerHeight,
      color: COLORS.primary,
    });

    page.drawText('MANGELMELDUNG & KOSTENSCHÄTZUNG', {
      x: marginX,
      y: height - 55,
      size: 18,
      font: fontBold,
      color: rgb(1, 1, 1), // Blanc
    });

    // Date et ID en haut à droite
    const dateStr = new Date().toLocaleDateString('de-DE');
    const dateLabel = `Datum: ${dateStr}`;
    const idLabel = `ID: ${ticket.id.split('-')[0]}...`; 

    page.drawText(dateLabel, {
      x: width - marginX - font.widthOfTextAtSize(dateLabel, 10),
      y: height - 45,
      size: 10,
      font,
      color: rgb(0.8, 0.8, 0.9),
    });
    page.drawText(idLabel, {
      x: width - marginX - font.widthOfTextAtSize(idLabel, 10),
      y: height - 60,
      size: 10,
      font,
      color: rgb(0.8, 0.8, 0.9),
    });

    let y = height - headerHeight - 40;
    const lineHeight = 14;

    const ensureSpace = (needed: number) => {
      if (y - needed < bottomMargin) {
        page = pdfDoc.addPage();
        y = height - 60; 
      }
    };

    // --- SECTION 1 : DETAILS ---
    page.drawText('Betreff / Objekt:', {
      x: marginX,
      y,
      size: 9,
      font: fontBold,
      color: COLORS.secondary,
    });
    y -= 12;
    
    const titleLines = wrapText(ticket.title || 'Sans titre', width - marginX * 2, fontBold, 14);
    for (const line of titleLines) {
        page.drawText(line, { x: marginX, y, size: 14, font: fontBold, color: COLORS.text });
        y -= 18;
    }
    y -= 10;

    page.drawLine({
        start: { x: marginX, y },
        end: { x: width - marginX, y },
        thickness: 1,
        color: COLORS.accent,
    });
    y -= 25;

    // --- SECTION 2 : ANALYSE (Avec détection de titres améliorée) ---
    ensureSpace(40);
    
    // Liste exacte des titres générés par Claude à mettre en valeur
    const detectedHeaders = [
        "Fotobeschreibung",
        "Mangelbeschreibung",
        "Leistungspositionen mit Kostengruppen nach DIN 276",
        "Ursache",
        "Maßnahmen",
        "Sanierungsempfehlung",
        "Fazit"
    ];

    const analysisLines = analysisText.split(/\r?\n/);
    for (let rawLine of analysisLines) {
      const line = rawLine.trimEnd();
      if (line.trim() === '') {
        y -= 8;
        continue;
      }

      // On vérifie si la ligne contient l'un des titres clés
      const isHeader = detectedHeaders.some(h => line.includes(h)) || (line.trim().endsWith(':') && line.length < 60);

      if (isHeader) {
          ensureSpace(40);
          y -= 15; // Espace avant le titre
          page.drawText(line, {
              x: marginX,
              y,
              size: 11,
              font: fontBold,
              color: COLORS.primary, // Titre en bleu
          });
          y -= 20; // Espace après le titre
      } else {
          const wrapped = wrapText(line, width - marginX * 2, font, 10);
          for (const l of wrapped) {
            ensureSpace(lineHeight);
            page.drawText(l, {
              x: marginX,
              y,
              size: 10,
              font,
              color: COLORS.text,
            });
            y -= lineHeight;
          }
      }
    }
    y -= 20;

    // --- SECTION 3 : TABLEAU DES COÛTS ---
    ensureSpace(60);
    
    // Titre explicite
    page.drawText('DETAILKOSTENAUFSTELLUNG', {
      x: marginX,
      y,
      size: 12,
      font: fontBold,
      color: COLORS.primary,
    });
    // AJOUT D'ESPACE APRES LE TITRE (ajusté pour que le tableau remonte un peu)
    y -= 20; 

    if (rows.length === 0) {
        page.drawText('Keine Positionen verfügbar.', { x: marginX, y, size: 10, font: fontOblique, color: COLORS.secondary });
        y -= 20;
    } else {
        // Configuration du tableau
        const col1X = marginX;
        const col2X = width - marginX - 140; // KG
        // Montant aligné à droite
        const col3RightX = width - marginX - 10; 
        const col1Width = col2X - col1X - 15; // Un peu plus de marge

        // Header tableau (Fond gris)
        // Augmentation de la hauteur pour aérer le header
        const headerHeight = 28; 
        
        // On dessine le rectangle. Coordonnée y est le coin bas-gauche du rectangle.
        // On veut que le top du rectangle soit à la position actuelle 'y'.
        page.drawRectangle({
            x: marginX,
            y: y - headerHeight, 
            width: width - marginX * 2,
            height: headerHeight,
            color: COLORS.accent,
        });
        
        // Centrage vertical du texte dans le header
        // Milieu du rectangle = y - (headerHeight / 2)
        // On décale légèrement vers le bas pour le baseline du texte (approx 3-4 pts)
        const headerTextY = y - (headerHeight / 2) - 3.5;

        // Textes Header
        // TAILLE 10 pour Leistungsbeschreibung (réduit de 1 comme demandé)
        // Couleur NOIR pour tous
        page.drawText('Leistungsbeschreibung', { x: col1X + 8, y: headerTextY, size: 10, font: fontBold, color: COLORS.black });
        page.drawText('KG', { x: col2X, y: headerTextY, size: 10, font: fontBold, color: COLORS.black });
        
        const headerAmountW = fontBold.widthOfTextAtSize('Betrag (Netto)', 10);
        page.drawText('Betrag (Netto)', { x: col3RightX - headerAmountW, y: headerTextY, size: 10, font: fontBold, color: COLORS.black });

        // On déplace y sous le header avec un petit espace
        y -= headerHeight + 10; 

        let totalNet = 0;

        for (const row of rows) {
            const isTotalRow = row.rowType === 'total';
            const isSubtotal = row.rowType === 'subtotal';
            
            // Détection ROBUSTE de "LP" (ex: "LP 1", "LP1:", "lp 12", "LP 3:")
            // Regex : Contient "LP" suivi d'un espace optionnel et d'un chiffre
            const labelTrimmed = (row.label || '').trim();
            const isLP = /LP\s*\d+/i.test(labelTrimmed);
            
            // Choix de la police : Gras si Total, Sous-total ou LP
            const rowFont = (isTotalRow || isSubtotal || isLP) ? fontBold : font;
            
            // Taille de police (9 pour tout le monde, sauf Totaux/LP en 10 pour le style)
            const contentSize = (isTotalRow || isSubtotal || isLP) ? 10 : 9;

            if (row.amount && row.rowType !== 'total' && row.rowType !== 'extra') {
                totalNet += row.amount;
            }

            const amountStr = formatCurrency(row.amount);
            const labelStr = row.label || (isTotalRow ? 'GESAMTSUMME' : 'Position');
            
            const labelLines = wrapText(labelStr, col1Width, rowFont, contentSize);
            
            // PADDING VERTICAL
            const paddingTop = 8;
            const paddingBottom = 8;
            const noteHeight = row.notes ? 12 : 0;
            
            // Recalcul hauteur
            const rowContentHeight = (labelLines.length * 12) + noteHeight;
            const totalRowHeight = paddingTop + rowContentHeight + paddingBottom;
            
            ensureSpace(totalRowHeight);

            // Fond gris pour totaux
            if (isTotalRow || isSubtotal) {
                page.drawRectangle({
                    x: marginX,
                    y: y - totalRowHeight + 10, // Ajustement Y
                    width: width - marginX * 2,
                    height: totalRowHeight,
                    color: COLORS.accent,
                });
            }

            // Calcul du Y pour commencer à écrire
            let textY = y - paddingTop; 

            // Colonne 1 : Label
            for (const l of labelLines) {
                page.drawText(l, {
                    x: col1X + 8,
                    y: textY,
                    size: contentSize,
                    font: rowFont, 
                    color: COLORS.black // Noir forcé
                });
                textY -= 12; // Line height
            }

            // Notes (sous le label)
            if (row.notes) {
                textY -= 2;
                const noteLines = wrapText(row.notes, col1Width, fontOblique, 8);
                for (const nl of noteLines) {
                    page.drawText(nl, {
                        x: col1X + 8,
                        y: textY,
                        size: 8,
                        font: fontOblique,
                        color: COLORS.secondary // Notes restent grises
                    });
                    textY -= 10;
                }
            }

            // Colonne 2 : KG (Noir)
            if (row.kostengruppe) {
                page.drawText(row.kostengruppe, {
                    x: col2X,
                    y: y - paddingTop,
                    size: 9,
                    font,
                    color: COLORS.black
                });
            }

            // Colonne 3 : Montant (Noir)
            const amountW = rowFont.widthOfTextAtSize(amountStr, contentSize);
            page.drawText(amountStr, {
                x: col3RightX - amountW,
                y: y - paddingTop,
                size: contentSize,
                font: rowFont,
                color: COLORS.black
            });

            // Ligne de séparation
            const separatorY = y - totalRowHeight + 5;
            
            if (!isTotalRow) {
                page.drawLine({
                    start: { x: marginX, y: separatorY }, 
                    end: { x: width - marginX, y: separatorY },
                    thickness: 0.5,
                    color: COLORS.divider,
                });
            }

            y -= totalRowHeight;
        }

        // --- RÉCAPITULATIF ---
        ensureSpace(100);
        y -= 20;

        const vatRate = 0.19;
        const vatAmount = totalNet * vatRate;
        const totalGross = totalNet + vatAmount;

        const summaryX = width - marginX - 220;
        
        // Netto (Label Noir)
        page.drawText('Summe Netto:', { x: summaryX, y, size: 10, font, color: COLORS.black });
        const netW = font.widthOfTextAtSize(formatCurrency(totalNet), 10);
        page.drawText(formatCurrency(totalNet), { x: col3RightX - netW, y, size: 10, font, color: COLORS.black });
        y -= 18;

        // TVA (Label Noir)
        page.drawText(`MwSt. (19%):`, { x: summaryX, y, size: 10, font, color: COLORS.black });
        const vatW = font.widthOfTextAtSize(formatCurrency(vatAmount), 10);
        page.drawText(formatCurrency(vatAmount), { x: col3RightX - vatW, y, size: 10, font, color: COLORS.black });
        y -= 25;

        // Ligne de total
        page.drawLine({
            start: { x: summaryX, y: y + 12 },
            end: { x: width - marginX, y: y + 12 },
            thickness: 1.5,
            color: COLORS.primary,
        });

        // TOTAL GLOBAL (Bleu)
        page.drawText('GESAMTBETRAG:', { x: summaryX, y, size: 12, font: fontBold, color: COLORS.primary });
        const grossStr = formatCurrency(totalGross);
        const grossW = fontBold.widthOfTextAtSize(grossStr, 12);
        page.drawText(grossStr, { x: col3RightX - grossW, y, size: 12, font: fontBold, color: COLORS.primary });
        y -= 40;
    }

    // --- FOOTER ---
    ensureSpace(60);
    y -= 20;
    page.drawText('Dieses Dokument wurde maschinell erstellt und ist ohne Unterschrift gültig.', {
        x: marginX,
        y,
        size: 8,
        font: fontOblique,
        color: COLORS.secondary,
    });
    
    const footerText = "Mangelmanagement System | Interne Kostenschätzung";
    const pages = pdfDoc.getPages();
    pages.forEach((p) => {
        p.drawText(footerText, {
            x: 50,
            y: 20,
            size: 8,
            font,
            color: rgb(0.6, 0.6, 0.6)
        });
    });

    const pdfBytes = await pdfDoc.save();

    // Correction TypeScript : Utilisation de Buffer.from
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Kostenschaetzung_${ticketId}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('❌ send-pdf error:', err);
    return NextResponse.json(
      { error: 'Erreur interne PDF', details: err?.message },
      { status: 500 }
    );
  }
}