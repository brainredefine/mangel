// /app/api/tickets/[id]/generate-report/route.ts

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getAdminUser } from "../../../../../lib/requireAdmin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type Ticket = {
  id: string;
  title: string | null;
  description: string | null;
  building_section: string | null;
  floor: string | null;
  room: string | null;
  location_description: string | null;
  categories: string[] | null;
  priority: string | null;
  tenant_id: string | null;
  created_by: string | null;
};

type TicketAttachment = {
  id: string;
  ticket_id: string;
  file_path: string;
  mime_type: string | null;
};

// Petit helper pour générer des IDs de lignes pseudo-uniques
function generateRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Helper pour convertir mime_type en media_type accepté par Claude
function getMediaType(mimeType: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | null {
  const supported = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (supported.includes(mimeType)) {
    return mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  }
  // Fallback pour jpg
  if (mimeType === "image/jpg") return "image/jpeg";
  return null;
}

export async function POST(req: Request, context: RouteContext) {
  try {
    // KI-Analyse kostet Geld und überschreibt Ticketdaten — nur für Admins.
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id: ticketId } = await context.params;

    if (!ticketId) {
      return NextResponse.json(
        { error: "ticketId manquant" },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY manquant" },
        { status: 500 }
      );
    }

    if (!process.env.ANTHROPIC_MODEL) {
      return NextResponse.json(
        {
          error: "ANTHROPIC_MODEL manquant",
          hint: "Définis ANTHROPIC_MODEL dans ton .env (ex: claude-sonnet-4-20250514).",
        },
        { status: 500 }
      );
    }

    const MODEL = process.env.ANTHROPIC_MODEL;

    // 1) Charger le ticket
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single<Ticket>();

    if (ticketError || !ticket) {
      console.error("ticketError", ticketError);
      return NextResponse.json(
        { error: "Ticket introuvable" },
        { status: 404 }
      );
    }

    // --- Nettoyage de la description: enlever le préfixe [📍 Objekt: ...] ---
    const originalDescription = ticket.description || "";

    let objektInfo = "-";
    let cleanedDescription = originalDescription;

    const objektRegex = /^\[📍\s*Objekt:\s*([^\]]+)\]\s*\n*/i;
    const match = originalDescription.match(objektRegex);

    if (match) {
      objektInfo = match[1].trim();
      cleanedDescription = originalDescription.replace(objektRegex, "").trim();
    }

    // 2) Charger les pièces jointes (images)
    const { data: attachments, error: attachmentsError } = await supabaseAdmin
      .from("ticket_attachments")
      .select("*")
      .eq("ticket_id", ticketId);

    if (attachmentsError) {
      console.error("attachmentsError", attachmentsError);
      return NextResponse.json(
        { error: "Erreur lors du chargement des pièces jointes" },
        { status: 500 }
      );
    }

    const imageAttachments: TicketAttachment[] =
      (attachments as TicketAttachment[] | null)?.filter(
        (att) =>
          typeof att.mime_type === "string" &&
          att.mime_type.startsWith("image/")
      ) ?? [];

    // 3) Télécharger les images et les convertir en base64
    const imageBlocks: any[] = [];

    for (const att of imageAttachments) {
      try {
        // Télécharger l'image depuis Supabase Storage
        const { data: fileData, error: downloadError } = await supabaseAdmin
          .storage
          .from("ticket_attachments")
          .download(att.file_path);

        if (downloadError || !fileData) {
          console.error("Download error for", att.file_path, downloadError);
          continue;
        }

        // Convertir en base64
        const arrayBuffer = await fileData.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");

        // Vérifier le media_type
        const mediaType = getMediaType(att.mime_type || "image/jpeg");
        if (!mediaType) {
          console.log("Unsupported media type:", att.mime_type);
          continue;
        }

        imageBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: base64,
          },
        });

        console.log(`✅ Image loaded: ${att.file_path} (${mediaType})`);
      } catch (imgErr) {
        console.error("Error processing image:", att.file_path, imgErr);
      }
    }

    console.log(`📷 Total images loaded: ${imageBlocks.length}`);

    // 4) Construire le prompt (JSON ONLY)
    const categories =
      Array.isArray(ticket.categories) && ticket.categories.length > 0
        ? ticket.categories.join(", ")
        : "-";

    const textContext = `
Du bist ein erfahrener deutscher Bausachverständiger.

Alle Informationen dienen ausschließlich der legalen Dokumentation von bestehenden Gebäudemängeln und der Kostenermittlung für deren Instandsetzung.

Ticketdaten (nur als Kontext, wenn sinnvoll im Text verwenden):
- Titel: ${ticket.title || "-"}
- Objekt: ${objektInfo}
- Bereich / Gebäudeteil: ${ticket.building_section || "-"}
- Detaillierte Ortsangabe: ${ticket.location_description || "-"}
- Beschreibung: ${cleanedDescription || "-"}
- Kategorien (intern): ${categories}
- Dringlichkeit: ${ticket.priority || "-"}

AUFGABE:
Analysiere die textliche Beschreibung und — falls vorhanden — die Bilder (Gebäudeschäden, technische Mängel, etc.).

Erstelle daraus eine Kostenanalyse in folgendem JSON-Format:

{
  "cost_analysis_text": "<ca. 300–500 Wörter Fließtext auf Deutsch, der den Mangel, die Ursachen, den empfohlenen Lösungsweg und besondere Risiken zusammenfasst — in der unten beschriebenen Struktur>",
  "cost_table": [
    {
      "id": "1763406379002-q4e5b3",
      "label": "Reparatur",
      "notes": "optional, kann leer sein",
      "amount": 500,
      "rowType": "subtotal",
      "kostengruppe": "KG 330"
    }
  ]
}

DETAILLIERTE ANFORDERUNGEN AN "cost_analysis_text":

1. Schreibe einen strukturierten Text auf Deutsch mit genau diesen Überschriften in dieser Reihenfolge:

Fotobeschreibung:
<Möglichst konkrete Beschreibung der vorliegenden Fotos: sichtbare Bauteile, Materialien, Schäden, Lage im Gebäude. Falls keine Bilder vorliegen, kurz darauf hinweisen und stattdessen die Textangaben beschreiben.>

Mangelbeschreibung:
•  <Kurze, stichpunktartige Beschreibung der wesentlichen Mängel (z. B. beschädigte Dampfsperre, Undichtigkeiten, Feuchtigkeit, Schimmel, unsachgemäße Ausführung, etc.)>
•  <weitere Punkte, falls erforderlich>

Leistungspositionen mit Kostengruppen nach DIN 276
Verwende Leistungspositionen (LP) in durchnummerierter Form (LP 1, LP 2, LP 3, …), aber die ANZAHL DER POSITIONEN IST FLEXIBEL. Erzeuge nur so viele LPs, wie fachlich sinnvoll sind (mindestens eine). Die folgenden LP 1 und LP 2 sind BEISPIELE, an deren Stil du dich orientieren sollst:

LP 1: <kurze Bezeichnung der ersten Hauptmaßnahme, z. B. "Reparatur der Dampfsperre/Dampfbremse">
KG XXX - <passende Beschreibung der Kostengruppe, z. B. "Dachkonstruktionen">
•  <Aufzählung der Einzelleistungen, z. B. Demontage, Lieferung und Montage, luftdichte Anschlüsse, spezielle Klebebänder, Prüfung, etc.>
Kostenschätzung LP 1: <geschätzter Betrag in EUR, z. B. "875,00 €">

LP 2: <weitere Maßnahme, z. B. "Beseitigung der Feuchtigkeitsschäden">
KG XXX - <passende Kostengruppe, z. B. "Sonstige Maßnahmen für Innenwände und -türen">
•  <Einzelleistungen (Untersuchung, Trocknung, Schimmelentfernung, Desinfektion, etc.)>
Kostenschätzung LP 2: <geschätzter Betrag in EUR>

HINWEIS:
- Wenn es für den Schaden weitere sinnvolle Maßnahmen gibt, füge zusätzliche Leistungspositionen LP 3, LP 4 usw. im gleichen Stil hinzu.
- Wenn der Schaden sehr einfach ist, kann auch nur eine Leistungsposition (LP 1) ausreichen.
- Die Anzahl der LPs im Text soll zu den Positionen in "cost_table" passen (1:n).

2. Stil:
- Klar, sachlich und gut lesbar.
- Der Text soll sich inhaltlich an dem oben beschriebenen Beispiel orientieren (Fotobeschreibung, Mangelbeschreibung, dann Leistungspositionen mit LP 1, LP 2, LP 3 usw. mit Kostengruppen nach DIN 276).
- Wenn Informationen fehlen (z. B. keine exakten Flächenangaben), formuliere plausibel und neutral ("geschätzte Fläche", "voraussichtlich", etc.).
- Die im Fließtext genannten Kostenschätzungen sollen grob mit den Werten in der "cost_table" übereinstimmen, müssen aber nicht centgenau identisch sein.

DEFINITIONEN FÜR "cost_table":

- "cost_table": Liste von Positionen.
- "id": eine pseudozufällige, eindeutige ID pro Position (z.B. ähnlich "1763406379002-q4e5b3"). Sie soll innerhalb des Tickets nicht doppelt vorkommen.
- "label": kurze Bezeichnung der Position (z.B. "Reparatur Dampfsperre", "Beseitigung Feuchtigkeitsschäden", "Erneuerung Wärmedämmung").
- "notes": optionale zusätzliche Erläuterungen; kann auch "" sein.
- "amount": Kostenschätzung in EUR als Zahl (number), ohne Währungssymbol, ohne Tausendertrennzeichen (z.B. 1250.5).
- "rowType": einer der Werte "subtotal" oder "extra".
- "kostengruppe": passende Kostengruppe nach DIN 276, z.B. "KG 330", "KG 340", "KG 360", "KG 410", "KG 440", "KG 700" etc. Du darfst auch spezifischere Untergruppen wie "KG 329", "KG 361", "KG 364" verwenden, wenn sie besser passen.

Zuordnung nach DIN 276 — immer die präziseste passende Kostengruppe wählen:
- KG 320: Erdberührende Bauteile, Fundamentabdichtung, Abdichtung im Erdreich
- KG 330: Außenwände, Fassaden, Fenster, Türen, Putzarbeiten außen, Abdichtung außen, Sockelsanierung
- KG 340: Innenwände, Innenputz, Innenanstrich, Schimmel innen, Innentüren
- KG 360: Dach, Dachkonstruktion, Dachabdichtung, Dachentwässerung
- KG 410: Sanitärtechnik (Wasser, Abwasser)
- KG 420: Heizungstechnik
- KG 430: Raumlufttechnik / Klimaanlagen / Lüftung
- KG 440: Elektrotechnik, Beleuchtung
- KG 460: Förderanlagen (Aufzug, Rolltreppe)
- KG 700: Gutachten, Messungen, Planung, Nebenkosten
- Weitere spezifische Untergruppen (z.B. KG 329, KG 361, KG 364) sind zulässig, wenn sie fachlich sinnvoll sind.

WICHTIG:
- Gib AUSSCHLIESSLICH gültiges JSON zurück.
- KEIN Markdown, KEINE Tabelle, KEINE zusätzlichen Erklärungen.
- KEIN Text außerhalb des JSON-Objekts.
`.trim();

    const messageContent: any[] = [
      {
        type: "text",
        text: textContext,
      },
      ...imageBlocks,
    ];

    // 5) Appel à Claude via TOOL USE (structured output). Die API liefert das
    //    Ergebnis direkt als JSON-Objekt (block.input) — kein JSON.parse mehr und
    //    damit keine Fehler durch nicht-escapte Anführungszeichen im deutschen Text.
    const ANALYSIS_TOOL = {
      name: "submit_kostenanalyse",
      description: "Übermittelt die strukturierte Mangel- und Kostenanalyse.",
      input_schema: {
        type: "object",
        properties: {
          cost_analysis_text: {
            type: "string",
            description:
              "Strukturierter Fließtext auf Deutsch (Fotobeschreibung, Mangelbeschreibung, Leistungspositionen mit DIN-276-Kostengruppen).",
          },
          cost_table: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                notes: { type: "string" },
                amount: { type: "number" },
                rowType: { type: "string", enum: ["position", "subtotal", "extra", "total"] },
                kostengruppe: { type: "string" },
              },
              required: ["label", "amount", "kostengruppe"],
            },
          },
        },
        required: ["cost_analysis_text", "cost_table"],
      },
    };

    const callClaude = async (): Promise<{ parsed: any | null; stopReason: string | null }> => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 16000,
          temperature: 0.2,
          tools: [ANALYSIS_TOOL],
          tool_choice: { type: "tool", name: "submit_kostenanalyse" },
          messages: [{ role: "user", content: messageContent }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Anthropic error:", errText);
        return { parsed: null, stopReason: "http_error" };
      }

      const json: any = await res.json();
      const stopReason: string | null = json?.stop_reason ?? null;

      let toolInput: any = null;
      if (Array.isArray(json.content)) {
        for (const block of json.content) {
          if (block.type === "tool_use" && block.input) {
            toolInput = block.input;
            break;
          }
        }
      }
      return { parsed: toolInput ?? null, stopReason };
    };

    let result = await callClaude();
    if (!result.parsed) {
      console.warn("⚠️ Kein Tool-Output — Retry. stop_reason:", result.stopReason);
      result = await callClaude();
    }

    if (!result.parsed) {
      console.error("❌ KI-Analyse: kein gültiger Tool-Output nach Retry.");
      return NextResponse.json(
        { error: "KI-Analyse fehlgeschlagen. Bitte erneut versuchen." },
        { status: 500 }
      );
    }

    const parsed: any = result.parsed;

    // 7) Validation minimale / normalisation
    const cost_analysis_text: string =
      typeof parsed.cost_analysis_text === "string"
        ? parsed.cost_analysis_text
        : "";

    let cost_table: any[] = Array.isArray(parsed.cost_table)
      ? parsed.cost_table
      : [];

    // S'assurer que chaque ligne a un id
    cost_table = cost_table.map((row) => ({
      id: row.id && typeof row.id === "string" ? row.id : generateRowId(),
      label: row.label ?? "",
      notes: row.notes ?? "",
      amount: typeof row.amount === "number" ? row.amount : 0,
      rowType: row.rowType ?? "subtotal",
      kostengruppe: row.kostengruppe ?? "",
    }));

    // 8) Update du ticket dans Supabase
    const { error: updateError } = await supabaseAdmin
      .from("tickets")
      .update({
        description: cleanedDescription,
        cost_analysis_text,
        cost_table,
      })
      .eq("id", ticketId);

    if (updateError) {
      console.error("updateError", updateError);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour du ticket" },
        { status: 500 }
      );
    }

    // 9) Réponse API
    return NextResponse.json({
      ok: true,
      ticketId,
      cost_analysis_text,
      cost_table,
    });
  } catch (err: any) {
    console.error("❌ generate-report error:", err);
    return NextResponse.json(
      { error: "Erreur interne", details: err?.message },
      { status: 500 }
    );
  }
}