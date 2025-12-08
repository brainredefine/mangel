// app/tickets/[id]/page.tsx
'use client';

import React, { useEffect, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import {
  Profile,
  TicketStatus,
  ChecklistSection,
  ChecklistState,
  Ticket,
  Attachment,
  AttachmentWithUrl,
  Message,
} from './types';
import {
  getBuildingInfoAction,
  getRecommendedVendorsAction,
  searchExternalVendorsAction,
  saveChosenExternalVendorAction,
  importChosenVendorToOdooAction,
  resetOdooVendorIdAction,
} from './actions';

// ✅ new mail helpers
import { buildSignedPhotoLinksText, buildMailtoHref } from './mail/mail';
import { buildInquiryMail } from './mail/mailInquiry';
import { buildOfferMail } from './mail/mailOffer';
import { getOfferMailContextAction } from './actions'; // ✅ ajoute l’export
// --- TYPES LOCAUX ---

type CostRow = {
  id: string;
  label: string;
  kostengruppe: string;
  amount: number | null;
  notes?: string;
  rowType?: 'position' | 'subtotal' | 'extra' | 'total';
};

type TicketWithMeta = Ticket & {
  odoo_tenancy_id: number | null;
  cost_analysis_text: string | null;
  cost_table: CostRow[] | null;
  tgm_street?: string | null;
  tgm_city?: string | null;
  tgm_zip?: string | null;
  tgm_mail?: string | null;
  tgm_phone?: string | null;
  odoo_vendor_id?: number | null;
  angebotsumme?: number | null; // Angebotsumme (vendor quote)
  beauftragungsumme?: number | null; // Beauftragungsumme (our commitment)
  rechnungsumme?: number | null; // Rechnungsumme (final invoice)
};

type BuildingInfo = {
  tenancy_id: number;
  tenancy_name: string;
  objekt_label: string;
  property_reference?: string;
  property_internal_label?: string | null;
  property_street?: string;
  property_zip?: string;
  property_city?: string;
  construction_year?: number | string | null;
  last_modernization?: number | string | null;
};

type Vendor = {
  id: number;
  name: string;
  email?: string | boolean;
  phone?: string | boolean;
  street?: string | boolean;
  zip?: string | boolean;
  city?: string | boolean;
  category_id?: any[];
};

type ExternalVendor = {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  sourceUrl?: string | null;
  snippet?: string | null;
  source?: string | null;
};

// --- CONSTANTES ---

const PM_STEPS = [
  { key: 'lease_checked', label: 'Mietvertrag auf Zuständigkeit geprüft' },
  { key: 'urgency_evaluated', label: 'Dringlichkeit bewertet' },
  { key: 'first_estimate_done', label: 'Erste Kostenschätzung erstellt' },
  { key: 'tenant_informed', label: 'Mieter über Entscheidung informiert' },
  { key: 'sent_to_fm', label: 'Bei Annahme: an Facility Manager weitergeleitet' },
];

const FM_STEPS = [
  { key: 'visit_done', label: 'Vor-Ort-Besichtigung durchgeführt oder Remote-Analyse' },
  { key: 'solution_defined', label: 'Technische Lösung definiert' },
  { key: 'vendors_selected', label: 'Geeignete Dienstleister ausgewählt' },
  { key: 'budget_estimated', label: 'Kostenrahmen festgelegt' },
  { key: 'dates_coordinated', label: 'Termine koordiniert' },
  { key: 'order_sent', label: 'Auftrag erstellt und versandt' },
];

const CONTRACTOR_STEPS = [
  { key: 'order_received', label: 'Auftrag und Objektzugang erhalten' },
  { key: 'photos_before', label: 'Vorher-Fotos gemacht' },
  { key: 'works_done', label: 'Arbeiten gemäß Auftrag durchgeführt' },
  { key: 'photos_after', label: 'Nachher-Fotos gemacht' },
  { key: 'digital_report_sent', label: 'Digitale Fertigmeldung abgesetzt' },
  { key: 'invoice_sent', label: 'Rechnung erstellt und übermittelt' },
  { key: 'invoice_paid_odoo', label: 'Invoice paid & registered in Odoo' },
];

function createRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params?.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [ticket, setTicket] = useState<TicketWithMeta | null>(null);
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  // ODOO INFO STATE
  const [buildingInfo, setBuildingInfo] = useState<BuildingInfo | null>(null);
  const [loadingBuildingInfo, setLoadingBuildingInfo] = useState(false);

  // VENDOR STATE (Odoo)
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [vendorsLoaded, setVendorsLoaded] = useState(false);

  // VENDORS EXTERNES (Web & IA)
  const [externalPrompt, setExternalPrompt] = useState('');
  const [externalVendors, setExternalVendors] = useState<ExternalVendor[]>([]);
  const [loadingExternalVendors, setLoadingExternalVendors] = useState(false);
  const [externalVendorsLoaded, setExternalVendorsLoaded] = useState(false);

  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [updatingAction, setUpdatingAction] = useState<string | null>(null);
  const [savingChecklistKey, setSavingChecklistKey] = useState<string | null>(null);

  // admin-only states
  const [priorityUpdating, setPriorityUpdating] = useState(false);
  const [adminNotesDraft, setAdminNotesDraft] = useState('');
  const [savingAdminNotes, setSavingAdminNotes] = useState(false);

  const [costDraft, setCostDraft] = useState('');
  const [angebotDraft, setAngebotDraft] = useState('');
  const [beauftragtDraft, setBeauftragtDraft] = useState('');
  const [rechnungDraft, setRechnungDraft] = useState('');

  const [savingCost, setSavingCost] = useState(false);
  const [expectedEndDraft, setExpectedEndDraft] = useState('');
  const [savingExpectedEnd, setSavingExpectedEnd] = useState(false);
  const [costAnalysisDraft, setCostAnalysisDraft] = useState('');
  const [savingCostAnalysis, setSavingCostAnalysis] = useState(false);
  const [costTableRows, setCostTableRows] = useState<CostRow[]>([]);
  const [savingCostTable, setSavingCostTable] = useState(false);

  const [savingAngebot, setSavingAngebot] = useState(false);
  const [savingBeauftragt, setSavingBeauftragt] = useState(false);
  const [savingRechnung, setSavingRechnung] = useState(false);

  // 🆕 Upload de pièces jointes côté admin
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentUploadError, setAttachmentUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false); // pour drag & drop

  const isAdminAm = profile?.role === 'admin_am';

  // --- CHARGEMENT INITIAL ---

  useEffect(() => {
    const load = async () => {
      if (!ticketId) return;

      setLoading(true);
      setErrorMsg(null);

      // 1. Auth
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push('/sign-in');
        return;
      }

      setCurrentUserId(user.id);

      // 2. Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        console.error(profileError);
        setErrorMsg('Ihr Profil kann nicht geladen werden.');
        setLoading(false);
        return;
      }

      setProfile(profileData as Profile);

      // ✅ security role local
      const isCurrentUserAdmin = profileData.role === 'admin_am';

      // 3. Ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticketData) {
        console.error(ticketError);
        setErrorMsg('Ticket nicht gefunden.');
        setLoading(false);
        return;
      }

      if (!isCurrentUserAdmin && ticketData.tenant_id !== profileData.tenant_id) {
        setErrorMsg('Sie haben keinen Zugriff auf dieses Ticket.');
        setLoading(false);
        return;
      }

      const t = ticketData as TicketWithMeta;
      setTicket(t);

      // Init drafts
      setAdminNotesDraft(t.admin_notes ?? '');
      setCostDraft(t.cost_estimated !== null && t.cost_estimated !== undefined ? String(t.cost_estimated) : '');
      setAngebotDraft(t.angebotsumme !== null && t.angebotsumme !== undefined ? String(t.angebotsumme) : '');
      setBeauftragtDraft(
        t.beauftragungsumme !== null && t.beauftragungsumme !== undefined ? String(t.beauftragungsumme) : ''
      );
      setRechnungDraft(t.rechnungsumme !== null && t.rechnungsumme !== undefined ? String(t.rechnungsumme) : '');

      setExpectedEndDraft(t.expected_enddate ? t.expected_enddate.slice(0, 10) : '');
      setCostAnalysisDraft(t.cost_analysis_text ?? '');

      if (Array.isArray(t.cost_table)) setCostTableRows(t.cost_table);
      else setCostTableRows([]);

      // 4. Attachments (AVEC FILTRAGE DE SÉCURITÉ)
      const { data: attachmentsData, error: attachmentsError } = await supabase
        .from('ticket_attachments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (attachmentsError) {
        console.error(attachmentsError);
      } else {
        // 🔒 filter private for non-admin
        const safeAttachments = (attachmentsData || []).filter((att: any) => {
          if (att.privacy === 'private' && !isCurrentUserAdmin) return false;
          return true;
        });

        const withUrls: AttachmentWithUrl[] = safeAttachments.map((att: Attachment) => {
          const { data } = supabase.storage.from('ticket_attachments').getPublicUrl(att.file_path);
          return { ...att, url: data?.publicUrl ?? null };
        });

        setAttachments(withUrls);
      }

      // 5. Messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (messagesError) console.error(messagesError);
      else setMessages((messagesData || []) as Message[]);

      setLoading(false);

      // 6. BUILDING INFO
      if (t.odoo_tenancy_id) {
        setLoadingBuildingInfo(true);
        try {
          const res = await getBuildingInfoAction(t.odoo_tenancy_id);
          if (res.success) setBuildingInfo(res.data as BuildingInfo);
          else console.warn('Building info error:', res.error);
        } catch (err) {
          console.error('Error fetching Odoo info', err);
        }
        setLoadingBuildingInfo(false);
      }
    };

    load();
  }, [router, ticketId]);

  // Pré-remplir le prompt externe avec une query simple optimisée Google Places
  useEffect(() => {
    if (!ticket) return;
    if (!buildingInfo) return;
    if (externalPrompt && externalPrompt.length > 3) return;

    const desc = (ticket.description || '').toLowerCase();

    let category = 'Handwerker';
    if (desc.includes('aufzug')) category = 'Aufzugsservice';
    else if (desc.includes('wasser') || desc.includes('rohr') || desc.includes('leck')) category = 'Sanitär Notdienst';
    else if (desc.includes('strom') || desc.includes('elektro')) category = 'Elektriker';
    else if (desc.includes('heizung') || desc.includes('wärme')) category = 'Heizungsservice';

    const city = buildingInfo.property_city || '';
    const zip = buildingInfo.property_zip || '';
    const query = `${category} ${city} ${zip}`.trim();

    setExternalPrompt(query);
  }, [ticket, buildingInfo, externalPrompt]);

  // --- HELPERS ---

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const formatDateShort = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const getPriorityLabel = (p: string) => {
    if (p === 'high') return 'Hoch';
    if (p === 'low') return 'Niedrig';
    return 'Normal';
  };

  const getStatusLabel = (s: TicketStatus) => {
    if (s === 'new') return 'Neu';
    if (s === 'open') return 'Offen';
    if (s === 'in_progress') return 'In Bearbeitung';
    if (s === 'closed') return 'Geschlossen';
    return s;
  };

  const getClosedReasonLabel = (reason: string | null) => {
    if (!reason) return null;
    if (reason === 'over_5000') return 'Geschlossen wegen Schäden > 5.000 €';
    if (reason === 'tenant_liability') return 'Geschlossen, da vom Mieter zu tragen';
    return `Geschlossen (${reason})`;
  };

  const formatCost = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    try {
      return value.toLocaleString('de-DE', {
        style: 'currency',
        currency: 'EUR',
      });
    } catch {
      return `${value} €`;
    }
  };

  // --- MAIL HANDLERS (2 templates) ---

  const handlePrepareInquiryMail = async (vendorName: string, email: string | null | undefined) => {
    if (!email) {
      alert('Keine E-Mail-Adresse für diesen Dienstleister hinterlegt.');
      return;
    }
    if (!ticket) return;

    try {
      const photoLinksText = await buildSignedPhotoLinksText(attachments, { excludePrivate: true });

      const costRows: CostRow[] = Array.isArray(ticket.cost_table) ? ticket.cost_table : costTableRows;

      const mail = buildInquiryMail({
        ticket,
        buildingInfo: (buildingInfo as any) ?? null,
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
  if (!email) return;
  if (!ticket?.odoo_tenancy_id) return;

  const ctxRes = await getOfferMailContextAction(ticket.odoo_tenancy_id, ticket.tenant_id);
  if (!ctxRes.success) {
    alert(`Odoo error: ${ctxRes.error}`);
    return;
  }

  const ctx = ctxRes.data;

  // ✅ ICI (juste après ctx)
  const companyName = ctx?.building?.company_name ?? null;

  const invoiceMailbox =
    companyName === 'Fund IV'
      ? 'inv-4@redefine.group'
      : companyName === 'Eagle'
      ? 'inv-eagle@redefine.group'
      : 'inv@redefine.group';

  const mail = buildOfferMail({
    vendorEmail: email,
    vendorName,
    description: ticket.description || ticket.title || 'Maßnahme',

    ownerEntityName: ctx?.ownerEntity?.name ?? null,
    ownerEntityAddress: ctx?.ownerEntity?.address ?? null,
    ownerEntityVat: ctx?.ownerEntity?.vat ?? null,

    tenantName: ctx?.tenant?.name ?? null,
    tenantAddress: ctx?.tenant?.address ?? null,
    tenantEmail: ctx?.tenant?.email ?? null,
    tenantPhone: ctx?.tenant?.phone ?? null,

    beauftragungsummeBrutto: ticket.beauftragungsumme ?? null,
    dueDateText: ticket.expected_enddate
      ? `schnellstmöglich, wie besprochen, spätestens zum ${ticket.expected_enddate.slice(0, 10)}`
      : null,

    invoiceMailbox, // ✅ et tu le passes ici
  });

  const href = `mailto:${encodeURIComponent(mail.to)}?subject=${encodeURIComponent(
    mail.subject
  )}&body=${encodeURIComponent(mail.body)}`;

  window.location.href = href;
};



  // --- MESSAGES ---

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticket || !currentUserId || !newMessage.trim()) return;

    setSendingMessage(true);

    const { data, error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticket.id,
        sender_id: currentUserId,
        body: newMessage.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setMessages((prev) => [...prev, data as Message]);
      setNewMessage('');
    }

    setSendingMessage(false);
  };

  // 🆕 1. Fonction logique d'upload pure (réutilisable)
  const uploadFileToSupabase = async (file: File) => {
    if (!ticket || !currentUserId) return;

    setUploadingAttachment(true);
    setAttachmentUploadError(null);

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `${ticket.tenant_id}/${ticket.id}/${Date.now()}-${safeName}`;

      // A. Upload Storage
      const { error: uploadError } = await supabase.storage.from('ticket_attachments').upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

      if (uploadError) throw uploadError;

      // B. Insert DB
      const { data: insertData, error: dbError } = await supabase
        .from('ticket_attachments')
        .insert({
          ticket_id: ticket.id,
          uploaded_by: currentUserId,
          file_path: path,
          original_name: file.name,
          mime_type: file.type || 'application/octet-stream',
          privacy: 'private',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // C. Get Public URL
      const { data: publicData } = supabase.storage.from('ticket_attachments').getPublicUrl(path);

      const newAtt: AttachmentWithUrl = {
        ...(insertData as Attachment),
        url: publicData?.publicUrl ?? null,
      };

      setAttachments((prev) => [...prev, newAtt]);
    } catch (err) {
      console.error('Admin upload attachment error', err);
      setAttachmentUploadError('Upload fehlgeschlagen.');
    } finally {
      setUploadingAttachment(false);
      setIsDragging(false);
    }
  };

  // 🆕 2. Handler pour l'input classique (click)
  const handleAdminFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFileToSupabase(file);
    e.target.value = '';
  };

  // 🆕 3. Handlers pour le Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (uploadingAttachment) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      uploadFileToSupabase(files[0]);
    }
  };

  // --- VENDORS ---

  const handleLoadVendors = async () => {
    if (!ticket?.odoo_tenancy_id) return;

    setLoadingVendors(true);
    setVendorsLoaded(true);

    const res = await getRecommendedVendorsAction(ticket.odoo_tenancy_id);
    if (res.success) setVendors(res.data as Vendor[]);
    else console.error(res.error);

    setLoadingVendors(false);
  };

  const handleChooseOdooVendor = async (vendor: Vendor) => {
    if (!ticket || !isAdminAm) return;

    const confirmMsg = `Choisir "${vendor.name}" comme prestataire principal pour ce Ticket ?`;
    if (!window.confirm(confirmMsg)) return;

    const street = typeof vendor.street === 'string' ? vendor.street : null;
    const zip = typeof vendor.zip === 'string' ? vendor.zip : null;
    const city = typeof vendor.city === 'string' ? vendor.city : null;
    const email = typeof vendor.email === 'string' ? vendor.email : null;
    const phone = typeof vendor.phone === 'string' ? vendor.phone : null;

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
      console.error('Error setting chosen_tgm (Odoo)', error);
      alert('Der ausgewählte Dienstleister konnte nicht gespeichert werden.');
      return;
    }

    setTicket((prev) => (prev ? ({ ...prev, ...(data as any) } as TicketWithMeta) : prev));
  };

  const handleChooseExternalVendor = async (vendor: ExternalVendor) => {
    if (!ticket || !isAdminAm) return;

    const confirmMsg = `"${vendor.name}" als Hauptdienstleister für dieses Ticket auswählen?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await saveChosenExternalVendorAction(ticket.id, vendor);

      if (!res.success) {
        console.error('[handleChooseExternalVendor] error', res.error);
        alert('Der ausgewählte externe Dienstleister konnte nicht gespeichert werden.');
        return;
      }

      setTicket(res.ticket as TicketWithMeta);
    } catch (err) {
      console.error('[handleChooseExternalVendor] unexpected error', err);
      alert('Fehler beim Speichern des externen Dienstleisters.');
    }
  };

  const handleSearchExternalVendors = async () => {
    if (!externalPrompt.trim()) return;
    if (!isAdminAm) return;

    setLoadingExternalVendors(true);
    setExternalVendorsLoaded(true);

    try {
      const res = await searchExternalVendorsAction(externalPrompt.trim());
      if (res.success) setExternalVendors((res.data || []) as ExternalVendor[]);
      else {
        console.error('searchExternalVendorsAction error', res.error);
        alert('Die externe Suche war nicht erfolgreich.');
      }
    } catch (err) {
      console.error('handleSearchExternalVendors error', err);
      alert('Fehler bei der externen Suche.');
    } finally {
      setLoadingExternalVendors(false);
    }
  };

  const handleImportChosenVendorToOdoo = async () => {
    try {
      const reset = await resetOdooVendorIdAction(ticketId);
      if (!reset.success) {
        alert('Reset odoo_vendor_id a échoué.');
        return;
      }

      const res = await importChosenVendorToOdooAction(ticketId);

      if (!res.success) {
        alert(`Import error: ${res.error}`);
        return;
      }

      if (res.alreadyImported) {
        alert('Dieser Dienstleister existiert bereits in Odoo.');
        return;
      }

      alert('Import OK!');
    } catch (e) {
      console.error(e);
      alert('Unexpected error');
    }
  };

  // --- ADMIN ACTIONS ---

  const handleOpenTicket = async () => {
    if (!ticket) return;
    setUpdatingAction('open');
    const { error } = await supabase.from('tickets').update({ status: 'open', closed_reason: null }).eq('id', ticket.id);
    if (!error) setTicket((prev) => (prev ? { ...prev, status: 'open', closed_reason: null } : prev));
    setUpdatingAction(null);
  };

  const handleCloseOver5000 = async () => {
    if (!ticket) return;
    setUpdatingAction('over_5000');
    const { error } = await supabase
      .from('tickets')
      .update({ status: 'closed', closed_reason: 'over_5000' })
      .eq('id', ticket.id);
    if (!error) setTicket((prev) => (prev ? { ...prev, status: 'closed', closed_reason: 'over_5000' } : prev));
    setUpdatingAction(null);
  };

  const handleCloseTenantLiability = async () => {
    if (!ticket) return;
    setUpdatingAction('tenant_liability');
    const { error } = await supabase
      .from('tickets')
      .update({ status: 'closed', closed_reason: 'tenant_liability' })
      .eq('id', ticket.id);
    if (!error)
      setTicket((prev) => (prev ? { ...prev, status: 'closed', closed_reason: 'tenant_liability' } : prev));
    setUpdatingAction(null);
  };

  const handlePriorityChange = async (newPriority: 'low' | 'medium' | 'high') => {
    if (!ticket) return;
    setPriorityUpdating(true);
    const { error } = await supabase.from('tickets').update({ priority: newPriority }).eq('id', ticket.id);
    if (!error) setTicket((prev) => (prev ? { ...prev, priority: newPriority } : prev));
    setPriorityUpdating(false);
  };

  // --- CHECKLIST ---

  const isStepChecked = (section: ChecklistSection, stepKey: string): boolean => {
    const checklist = (ticket?.checklist || {}) as ChecklistState;
    return !!(checklist[section] || {})[stepKey];
  };

  const toggleChecklistStep = async (section: ChecklistSection, stepKey: string) => {
    if (!ticket || !isAdminAm) return;
    const checklistKey = `${section}:${stepKey}`;
    setSavingChecklistKey(checklistKey);

    const currentChecklist: ChecklistState = ticket.checklist || {};
    const sectionState = { ...(currentChecklist[section] || {}) };
    const nextValue = !sectionState[stepKey];
    sectionState[stepKey] = nextValue;
    const newChecklist = { ...currentChecklist, [section]: sectionState };

    const shouldSetInProgress = section === 'pm' && stepKey === 'sent_to_fm' && nextValue && ticket.status !== 'closed';

    const payload: any = { checklist: newChecklist };
    if (shouldSetInProgress) payload.status = 'in_progress';

    const { error } = await supabase.from('tickets').update(payload).eq('id', ticket.id);

    if (!error) {
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              checklist: newChecklist,
              ...(shouldSetInProgress ? { status: 'in_progress' } : {}),
            }
          : prev
      );
    }

    setSavingChecklistKey(null);
  };

  const handleFinalCloseToggle = async () => {
    if (!ticket || !isAdminAm) return;
    if (isStepChecked('pm', 'final_closed')) return;
    if (!confirm('Sind Sie sicher, dass Sie das Ticket schließen möchten?')) return;

    setSavingChecklistKey('pm:final_closed');
    const currentChecklist = ticket.checklist || {};
    const newChecklist = {
      ...currentChecklist,
      pm: { ...(currentChecklist.pm || {}), final_closed: true },
    };

    const { error } = await supabase.from('tickets').update({ checklist: newChecklist, status: 'closed' }).eq('id', ticket.id);

    if (!error) setTicket((prev) => (prev ? { ...prev, checklist: newChecklist, status: 'closed' } : prev));
    setSavingChecklistKey(null);
  };

  // --- ADMIN DATA (Notes, Costs, Dates) ---

  const handleSaveAdminNotes = async () => {
    if (!ticket) return;
    setSavingAdminNotes(true);
    const { error } = await supabase
      .from('tickets')
      .update({ admin_notes: adminNotesDraft.trim() || null })
      .eq('id', ticket.id);

    if (!error) setTicket((prev) => (prev ? { ...prev, admin_notes: adminNotesDraft.trim() || null } : prev));
    setSavingAdminNotes(false);
  };

  const saveMoneyField = async (
    field: 'cost_estimated' | 'angebotsumme' | 'beauftragungsumme' | 'rechnungsumme',
    draftValue: string,
    setSaving: (v: boolean) => void,
    setDraft?: (v: string) => void
  ) => {
    if (!ticket) return;

    setSaving(true);

    const val = draftValue.trim() ? parseFloat(draftValue.replace(',', '.')) : null;
    if (val !== null && isNaN(val)) {
      alert('Invalide Zahl');
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('tickets').update({ [field]: val } as any).eq('id', ticket.id).select('*').single();

    if (!error) {
      setTicket((prev) => (prev ? ({ ...prev, [field]: val } as any) : prev));
      if (setDraft) setDraft(val === null ? '' : String(val));
    }

    setSaving(false);
  };

  const handleSaveExpectedEnd = async () => {
    if (!ticket) return;
    setSavingExpectedEnd(true);
    const val = expectedEndDraft.trim() || null;
    const { error } = await supabase.from('tickets').update({ expected_enddate: val }).eq('id', ticket.id);
    if (!error) setTicket((prev) => (prev ? { ...prev, expected_enddate: val } : prev));
    setSavingExpectedEnd(false);
  };

  const handleSaveCostAnalysis = async () => {
    if (!ticket) return;
    setSavingCostAnalysis(true);
    const { error } = await supabase
      .from('tickets')
      .update({ cost_analysis_text: costAnalysisDraft.trim() || null })
      .eq('id', ticket.id);

    if (!error)
      setTicket((prev) => (prev ? { ...prev, cost_analysis_text: costAnalysisDraft.trim() || null } : prev));
    setSavingCostAnalysis(false);
  };

  // --- COST TABLE ---

  const handleCostRowChange = (id: string, field: keyof CostRow, value: string) => {
    setCostTableRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === 'amount') {
          const v = value.trim().replace(',', '.');
          return {
            ...r,
            amount: v === '' ? null : isNaN(parseFloat(v)) ? r.amount : parseFloat(v),
          };
        }
        if (field === 'rowType') return { ...r, rowType: value as any };
        return { ...r, [field]: value };
      })
    );
  };

  const handleAddCostRow = () => {
    setCostTableRows((prev) => [
      ...prev,
      {
        id: createRowId(),
        label: '',
        kostengruppe: '',
        amount: null,
        notes: '',
        rowType: 'position',
      },
    ]);
  };

  const handleDeleteCostRow = (id: string) => {
    setCostTableRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSaveCostTable = async () => {
    if (!ticket) return;
    setSavingCostTable(true);
    const { error } = await supabase.from('tickets').update({ cost_table: costTableRows }).eq('id', ticket.id);
    if (!error) setTicket((prev) => (prev ? { ...prev, cost_table: costTableRows } : prev));
    setSavingCostTable(false);
  };

  const subtotal = costTableRows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const taxAmount = subtotal * 0.19;
  const totalWithTax = subtotal + taxAmount;

  // --- RENDER ---

  if (loading)
    return (
      <main className="min-h-screen w-full bg-gray-100 flex items-center justify-center p-6 text-gray-900">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-600">Ticket wird geladen...</p>
        </div>
      </main>
    );

  if (errorMsg && !ticket)
    return (
      <main className="min-h-screen w-full bg-gray-100 flex items-center justify-center p-6 text-gray-900">
        <div className="w-full max-w-md bg-white p-6 rounded-xl shadow-sm border border-red-200 text-center space-y-4">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-600 text-xl">
            ⚠️
          </div>
          <p className="text-red-600 text-sm">{errorMsg || 'Ticket nicht gefunden.'}</p>
          <button onClick={() => router.push('/tickets/existing')} className="text-sm underline text-gray-600 hover:text-gray-900">
            Zurück zur Liste
          </button>
        </div>
      </main>
    );

  if (!ticket) return null;

  return (
    <main className="min-h-screen w-full bg-gray-100 flex items-start justify-center p-6 text-gray-900">
      <div className="w-full max-w-5xl space-y-6">
        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => router.push(isAdminAm ? '/backoffice/tickets' : '/tickets/existing')}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition flex items-center gap-1"
          >
            ← Zurück
          </button>

          {isAdminAm && (
            <div className="flex items-center gap-3">
              {/* ✅ removed PDF Generieren button */}
              <button
                onClick={() => router.push('/backoffice/tickets')}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition shadow-sm"
              >
                Backoffice
              </button>
            </div>
          )}
        </div>

        {/* BUILDING INFO */}
        {(isAdminAm || buildingInfo) && (
          <div className="bg-white border-l-4 border-blue-600 rounded-r-xl shadow-sm p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-gray-900 text-sm mb-2 uppercase tracking-wide">
                Gebäudeinformationen {isAdminAm ? '(Odoo)' : ''}
              </h3>

              {loadingBuildingInfo ? (
                <span className="text-xs text-gray-400 animate-pulse">Lade Daten...</span>
              ) : buildingInfo ? (
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-gray-500 w-24 inline-block">Objekt:</span>
                    <span className="font-medium text-gray-900">{buildingInfo.objekt_label}</span>
                  </p>

                  <p>
                    <span className="text-gray-500 w-24 inline-block">Tenancy:</span>
                    <span className="font-medium text-gray-900">
                      {buildingInfo.tenancy_id} – {buildingInfo.tenancy_name}
                    </span>
                  </p>

                  <div className="flex gap-4 mt-2">
                    <div>
                      <span className="text-gray-500 text-xs block">Baujahr</span>
                      <span className="font-bold text-gray-900">{buildingInfo.construction_year || '-'}</span>
                    </div>

                    <div>
                      <span className="text-gray-500 text-xs block">Modernisierung</span>
                      <span className="font-bold text-gray-900">{buildingInfo.last_modernization || '-'}</span>
                    </div>
                  </div>

                  {isAdminAm &&
                    buildingInfo.construction_year &&
                    new Date().getFullYear() - Number(buildingInfo.construction_year) <= 5 && (
                      <div className="mt-3 flex items-center gap-2 text-red-700 font-semibold text-xs bg-red-50 p-2 rounded border border-red-100">
                        <span>⚠️</span>
                        <span>ACHTUNG: Gewährleistung möglich (Baujahr ≤ 5 Jahre)</span>
                      </div>
                    )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">
                  Keine Gebäudedaten in Odoo gefunden (Tenancy ID: {ticket.odoo_tenancy_id}).
                </p>
              )}
            </div>

            <div className="text-3xl opacity-20">🏢</div>
          </div>
        )}

        {/* HEADER TICKET */}
        <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6 border-b border-gray-100 pb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{ticket.title}</h1>
              <div className="text-sm text-gray-500 flex flex-wrap items-center gap-3">
                <span>Erstellt am {formatDate(ticket.created_at)}</span>
                <span>•</span>
                <span className="font-mono">ID: {ticket.id.slice(0, 8)}...</span>
              </div>

              {ticket.expected_enddate && (
                <div className="mt-3 inline-flex items-center gap-2 bg-blue-50 text-blue-900 px-3 py-1.5 rounded-lg text-sm border border-blue-100">
                  <span>📅</span>
                  <span className="font-medium">Voraussichtliches Ende:</span>
                  <span className="font-bold">{formatDateShort(ticket.expected_enddate)}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600 border border-gray-200 h-fit">
                {getPriorityLabel(ticket.priority)}
              </span>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100 h-fit">
                {getStatusLabel(ticket.status)}
              </span>
              {isAdminAm && ticket.cost_estimated && (
                <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100 h-fit">
                  Est. {formatCost(ticket.cost_estimated)}
                </span>
              )}
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-gray-700">
            <p className="whitespace-pre-line leading-relaxed">{ticket.description}</p>
          </div>

          {ticket.status === 'closed' && (
            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600 flex items-center gap-2">
              <span>ℹ️</span> {getClosedReasonLabel(ticket.closed_reason)}
            </div>
          )}

          {/* ADMIN CONTROLS */}
          {isAdminAm && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Verwaltung</h3>

              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Dringlichkeit:</label>
                  <select
                    value={ticket.priority}
                    onChange={(e) => handlePriorityChange(e.target.value as any)}
                    disabled={priorityUpdating}
                    className="rounded-lg border-gray-300 text-sm py-1.5 pl-3 pr-8 focus:ring-black focus:border-black bg-gray-50"
                  >
                    <option value="low">Niedrig</option>
                    <option value="medium">Normal</option>
                    <option value="high">Hoch</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  {(ticket.status === 'new' || ticket.status === 'closed') && (
                    <button
                      onClick={handleOpenTicket}
                      disabled={!!updatingAction}
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                    >
                      Ticket öffnen
                    </button>
                  )}

                  {ticket.status !== 'closed' && (
                    <>
                      <button
                        onClick={handleCloseOver5000}
                        disabled={!!updatingAction}
                        className="px-3 py-1.5 bg-white border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition"
                      >
                        Schließen (&gt; 5k€)
                      </button>
                      <button
                        onClick={handleCloseTenantLiability}
                        disabled={!!updatingAction}
                        className="px-3 py-1.5 bg-white border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition"
                      >
                        Schließen (Mieter)
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CHECKLIST */}
        {isAdminAm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4 mb-6">Prozess-Checkliste</h2>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { title: 'Property Manager', steps: PM_STEPS, section: 'pm' },
                { title: 'Facility Manager', steps: FM_STEPS, section: 'fm' },
                { title: 'Dienstleister', steps: CONTRACTOR_STEPS, section: 'contractor' },
              ].map((group) => (
                <div key={group.section} className="space-y-4">
                  <h3 className="font-semibold text-gray-900 text-xs uppercase tracking-wide bg-gray-50 p-2 rounded">
                    {group.title}
                  </h3>

                  <div className="space-y-3 pl-1">
                    {group.steps.map((step) => {
                      const key = `${group.section}:${step.key}`;
                      const checked = isStepChecked(group.section as ChecklistSection, step.key);
                      const saving = savingChecklistKey === key;

                      return (
                        <label key={step.key} className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={saving}
                            onChange={() => toggleChecklistStep(group.section as ChecklistSection, step.key)}
                            className="mt-0.5 rounded border-gray-300 text-black focus:ring-black"
                          />
                          <span
                            className={`text-sm leading-snug ${
                              checked
                                ? 'text-gray-400 line-through'
                                : 'text-gray-700 group-hover:text-gray-900 transition'
                            }`}
                          >
                            {step.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-red-50 transition w-fit border border-transparent hover:border-red-100">
                <input
                  type="checkbox"
                  checked={isStepChecked('pm', 'final_closed')}
                  disabled={savingChecklistKey === 'pm:final_closed' || ticket.status === 'closed'}
                  onChange={handleFinalCloseToggle}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-600"
                />
                <span className="font-medium text-red-700">Prozess abgeschlossen & Ticket schließen</span>
              </label>
            </div>
          </div>
        )}

        {/* VENDOR SUGGESTIONS (Odoo) */}
        {isAdminAm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Zugeordnete Dienstleister (Odoo)</h2>

                {ticket.chosen_tgm && (
                  <div className="mt-2 text-sm">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <span>✅</span>
                      <span>
                        Ausgewählter Dienstleister: <strong>{ticket.chosen_tgm}</strong>
                      </span>
                    </span>
                  </div>
                )}
              </div>

              {!vendorsLoaded && (
                <button
                  onClick={handleLoadVendors}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition"
                >
                  Liste laden
                </button>
              )}
            </div>

            {vendorsLoaded && (
              <div className="space-y-4">
                {loadingVendors ? (
                  <div className="text-sm text-gray-500 animate-pulse">
                    Suche nach Dienstleistern mit den Tags &quot;Maintenance&quot; + Gebäude-Tag...
                  </div>
                ) : vendors.length === 0 ? (
                  <div className="p-4 bg-gray-50 text-gray-600 rounded-lg text-sm border border-gray-200 italic">
                    Keine Dienstleister mit dem Gebäude-Tag gefunden.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {vendors.map((vendor) => {
                      const isChosen = ticket.chosen_tgm === vendor.name;

                      return (
                        <div
                          key={vendor.id}
                          className={`border rounded-lg p-4 bg-gray-50 hover:shadow-sm transition ${
                            isChosen
                              ? 'border-emerald-400 ring-1 ring-emerald-200 bg-emerald-50/40'
                              : 'border-gray-200'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h4 className="font-bold text-gray-900">{vendor.name}</h4>
                              {isChosen && (
                                <span className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  ✅ Ausgewählt
                                </span>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <button
                                onClick={() => {
                                  const address = [vendor.street, vendor.zip, vendor.city].filter(Boolean).join(' ');
                                  const contact = [vendor.phone, vendor.email].filter(Boolean).join(' / ');
                                  const text = [vendor.name, address || null, contact || null].filter(Boolean).join(' – ');
                                  navigator.clipboard.writeText(text);
                                  alert('Copié !');
                                }}
                                className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-100 text-gray-600"
                              >
                                Kopieren
                              </button>

                              <button
                                onClick={() => handleChooseOdooVendor(vendor)}
                                className="text-xs mt-1 px-2 py-1 rounded border border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                              >
                                Auswählen
                              </button>

                              {typeof vendor.email === 'string' && vendor.email && (
                                <>
                                  <button
                                    onClick={() => handlePrepareInquiryMail(vendor.name as string, vendor.email as string)}
                                    className="text-xs mt-1 px-2 py-1 rounded border border-blue-500 text-blue-700 bg-blue-50 hover:bg-blue-100"
                                  >
                                    Mail vorbereiten
                                  </button>

                                  <button
                                    onClick={() => handlePrepareOfferMail(vendor.name as string, vendor.email as string)}
                                    className="text-xs mt-1 px-2 py-1 rounded border border-indigo-500 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                                  >
                                    Mail vorbereiten – Send offer
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 space-y-1 text-sm text-gray-700">
                            {(vendor.street || vendor.zip || vendor.city) && (
                              <div>
                                📍 <span className="font-mono">{[vendor.street, vendor.zip, vendor.city].filter(Boolean).join(' ')}</span>
                              </div>
                            )}

                            {vendor.phone && (
                              <div>
                                📞 <span className="font-mono">{vendor.phone}</span>
                              </div>
                            )}

                            {vendor.email && (
                              <div>
                                ✉️{' '}
                                <a href={`mailto:${vendor.email}`} className="text-blue-600 hover:underline">
                                  {vendor.email}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VENDORS EXTERNES */}
        {isAdminAm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Externe Dienstleister (Web &amp; KI)</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Online-Suche nach lokalen Dienstleistern (Google, Bewertungen usw.). Ergebnisse bitte vor der Auftragsvergabe prüfen.
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={handleSearchExternalVendors}
                  disabled={loadingExternalVendors || !externalPrompt.trim()}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition"
                >
                  {loadingExternalVendors ? 'Suche läuft...' : 'Externen Dienstleister finden'}
                </button>

                {ticket.chosen_tgm && !(ticket.odoo_vendor_id && ticket.odoo_vendor_id > 0) && (
                  <button
                    onClick={handleImportChosenVendorToOdoo}
                    className="text-xs px-3 py-1 rounded border border-indigo-500 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                  >
                    Ausgewählten Dienstleister in Odoo importieren
                  </button>
                )}
              </div>
            </div>

            {ticket.chosen_tgm && (
              <div className="mb-6 p-4 rounded-lg border border-emerald-300 bg-emerald-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Hauptdienstleister</div>
                  <div className="mt-1 text-base font-bold text-gray-900">{ticket.chosen_tgm}</div>
                  <div className="mt-2 space-y-1 text-sm text-gray-700">
                    {(ticket.tgm_street || ticket.tgm_zip || ticket.tgm_city) && (
                      <div>
                        📍{' '}
                        <span className="font-mono">
                          {[ticket.tgm_street, ticket.tgm_zip, ticket.tgm_city].filter(Boolean).join(' ')}
                        </span>
                      </div>
                    )}
                    {ticket.tgm_phone && (
                      <div>
                        📞 <span className="font-mono">{ticket.tgm_phone}</span>
                      </div>
                    )}
                    {ticket.tgm_mail && (
                      <div>
                        ✉️{' '}
                        <a href={`mailto:${ticket.tgm_mail}`} className="text-blue-600 hover:underline break-all">
                          {ticket.tgm_mail}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {ticket.tgm_mail && (
                    <>
                      <button
                        onClick={() => handlePrepareInquiryMail(ticket.chosen_tgm!, ticket.tgm_mail!)}
                        className="text-xs px-3 py-1 rounded border border-blue-500 text-blue-700 bg-blue-50 hover:bg-blue-100"
                      >
                        Mail vorbereiten
                      </button>

                      <button
                        onClick={() => handlePrepareOfferMail(ticket.chosen_tgm!, ticket.tgm_mail!)}
                        className="text-xs px-3 py-1 rounded border border-indigo-500 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                      >
                        Mail vorbereiten – Send offer
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Such-Prompt (bearbeitbar)</label>
              <textarea
                className="w-full rounded-lg border-gray-300 text-sm focus:ring-black focus:border-black min-h-[80px] p-3 bg-gray-50"
                value={externalPrompt}
                onChange={(e) => setExternalPrompt(e.target.value)}
                placeholder="Ex: Sanitär Notdienst Bad Mergentheim 97980 mit sehr guten Bewertungen."
              />
            </div>

            {externalVendorsLoaded && (
              <div className="space-y-4">
                {loadingExternalVendors ? (
                  <div className="text-sm text-gray-500 animate-pulse">Suche nach externen Dienstleistern im Web...</div>
                ) : externalVendors.length === 0 ? (
                  <div className="p-4 bg-gray-50 text-gray-600 rounded-lg text-sm border border-gray-200 italic">
                    Für diese Suche wurden keine externen Dienstleister gefunden.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {externalVendors.map((vendor) => {
                      const isChosen = ticket.chosen_tgm === vendor.name;

                      return (
                        <div
                          key={vendor.id}
                          className={`border rounded-lg p-4 bg-gray-50 hover:shadow-sm transition ${
                            isChosen
                              ? 'border-emerald-400 ring-1 ring-emerald-200 bg-emerald-50/40'
                              : 'border-gray-200'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h4 className="font-bold text-gray-900">{vendor.name}</h4>

                              {vendor.rating !== null && vendor.rating !== undefined && (
                                <div className="mt-1 flex items-center gap-2 text-xs">
                                  <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                                    ★ {typeof vendor.rating === 'number' ? vendor.rating.toFixed(1) : vendor.rating}
                                  </span>
                                  {vendor.reviewCount !== null && vendor.reviewCount !== undefined && (
                                    <span className="text-[10px] text-gray-500">({vendor.reviewCount} avis)</span>
                                  )}
                                </div>
                              )}

                              {isChosen && (
                                <span className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  ✅ Ausgewählt
                                </span>
                              )}

                              {vendor.source && <p className="text-[10px] text-gray-400 mt-1">Source : {vendor.source}</p>}
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <button
                                onClick={() => {
                                  const parts = [
                                    vendor.name,
                                    vendor.address || null,
                                    vendor.phone || null,
                                    vendor.email || null,
                                    vendor.website || vendor.sourceUrl || null,
                                  ]
                                    .filter(Boolean)
                                    .join(' – ');
                                  navigator.clipboard.writeText(parts);
                                  alert('Copié !');
                                }}
                                className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-100 text-gray-600"
                              >
                                Copier
                              </button>

                              <button
                                onClick={() => handleChooseExternalVendor(vendor)}
                                className="text-xs mt-1 px-2 py-1 rounded border border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                              >
                                Auswählen
                              </button>

                              {vendor.email && (
                                <>
                                  <button
                                    onClick={() => handlePrepareInquiryMail(vendor.name, vendor.email)}
                                    className="text-xs mt-1 px-2 py-1 rounded border border-blue-500 text-blue-700 bg-blue-50 hover:bg-blue-100"
                                  >
                                    Mail vorbereiten
                                  </button>

                                  <button
                                    onClick={() => handlePrepareOfferMail(vendor.name, vendor.email)}
                                    className="text-xs mt-1 px-2 py-1 rounded border border-indigo-500 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                                  >
                                    Mail vorbereiten – Send offer
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {vendor.snippet && <p className="mt-2 text-xs text-gray-600 line-clamp-3">{vendor.snippet}</p>}

                          <div className="mt-2 space-y-1 text-sm text-gray-700">
                            {vendor.address && (
                              <div>
                                📍 <span className="font-mono">{vendor.address}</span>
                              </div>
                            )}
                            {vendor.phone && (
                              <div>
                                📞 <span className="font-mono">{vendor.phone}</span>
                              </div>
                            )}
                            {vendor.email && (
                              <div>
                                ✉️{' '}
                                <a href={`mailto:${vendor.email}`} className="text-blue-600 hover:underline break-all">
                                  {vendor.email}
                                </a>
                              </div>
                            )}
                            {vendor.website && (
                              <div>
                                🌐{' '}
                                <a
                                  href={vendor.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline break-all"
                                >
                                  {vendor.website}
                                </a>
                              </div>
                            )}
                            {!vendor.website && vendor.sourceUrl && (
                              <div>
                                🔗{' '}
                                <a
                                  href={vendor.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline break-all"
                                >
                                  Quelle öffnen
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* NOTES & COSTS */}
        {isAdminAm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            <h2 className="font-bold text-gray-900">Preise & Termine</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Voraussichtliches Ende</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    className="flex-1 rounded-lg border-gray-300 text-sm focus:ring-black focus:border-black"
                    value={expectedEndDraft}
                    onChange={(e) => setExpectedEndDraft(e.target.value)}
                  />
                  <button
                    onClick={handleSaveExpectedEnd}
                    disabled={savingExpectedEnd}
                    className="px-3 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 transition"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cost estimation</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-lg border-gray-300 text-sm focus:ring-black focus:border-black"
                    value={costDraft}
                    onChange={(e) => setCostDraft(e.target.value)}
                    placeholder="0.00"
                  />
                  <button
                    onClick={() => saveMoneyField('cost_estimated', costDraft, setSavingCost)}
                    disabled={savingCost}
                    className="px-3 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 transition"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Angebotsumme (Dienstleister)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-lg border-gray-300 text-sm focus:ring-black focus:border-black"
                    value={angebotDraft}
                    onChange={(e) => setAngebotDraft(e.target.value)}
                    placeholder="0.00"
                  />
                  <button
                    onClick={() => saveMoneyField('angebotsumme', angebotDraft, setSavingAngebot)}
                    disabled={savingAngebot}
                    className="px-3 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 transition"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Beauftragungsumme (von uns)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-lg border-gray-300 text-sm focus:ring-black focus:border-black"
                    value={beauftragtDraft}
                    onChange={(e) => setBeauftragtDraft(e.target.value)}
                    placeholder="0.00"
                  />
                  <button
                    onClick={() => saveMoneyField('beauftragungsumme', beauftragtDraft, setSavingBeauftragt)}
                    disabled={savingBeauftragt}
                    className="px-3 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 transition"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Rechnungsumme (Final invoice)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-lg border-gray-300 text-sm focus:ring-black focus:border-black"
                    value={rechnungDraft}
                    onChange={(e) => setRechnungDraft(e.target.value)}
                    placeholder="0.00"
                  />
                  <button
                    onClick={() => saveMoneyField('rechnungsumme', rechnungDraft, setSavingRechnung)}
                    disabled={savingRechnung}
                    className="px-3 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 transition"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 grid md:grid-cols-4 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="text-xs text-gray-500">Estimation</div>
                <div className="font-bold">{formatCost(ticket.cost_estimated)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="text-xs text-gray-500">Angebot</div>
                <div className="font-bold">{formatCost(ticket.angebotsumme)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="text-xs text-gray-500">Beauftragt</div>
                <div className="font-bold">{formatCost(ticket.beauftragungsumme)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="text-xs text-gray-500">Rechnung</div>
                <div className="font-bold">{formatCost(ticket.rechnungsumme)}</div>
              </div>
            </div>
          </div>
        )}

        {/* COST TABLE */}
        {isAdminAm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Kostenanalyse & Details</h2>
              <button
                onClick={handleSaveCostAnalysis}
                disabled={savingCostAnalysis}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50 transition"
              >
                {savingCostAnalysis ? 'Speichert...' : 'Analyse speichern'}
              </button>
            </div>

            <textarea
              className="w-full rounded-lg border-gray-300 text-sm focus:ring-black focus:border-black min-h-[120px] p-4 bg-gray-50"
              value={costAnalysisDraft}
              onChange={(e) => setCostAnalysisDraft(e.target.value)}
              placeholder="KI-Analyse oder manuelle Beschreibung..."
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="font-semibold text-gray-700 text-sm">Leistungspositionen</h3>
                <button
                  onClick={handleAddCostRow}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg transition"
                >
                  + Zeile
                </button>
              </div>

              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Position</th>
                      <th className="px-4 py-3 w-20">KG</th>
                      <th className="px-4 py-3 w-28 text-right">Betrag</th>
                      <th className="px-4 py-3">Notiz</th>
                      <th className="px-4 py-3 w-24">Typ</th>
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 bg-white">
                    {costTableRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-gray-400 text-xs italic">
                          Keine Positionen
                        </td>
                      </tr>
                    ) : (
                      costTableRows.map((row) => (
                        <tr key={row.id} className="group hover:bg-gray-50">
                          <td className="p-2">
                            <input
                              type="text"
                              className="w-full text-sm border-transparent bg-transparent focus:border-gray-300 focus:bg-white rounded px-2 py-1"
                              value={row.label}
                              onChange={(e) => handleCostRowChange(row.id, 'label', e.target.value)}
                              placeholder="Beschreibung"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              className="w-full text-sm border-transparent bg-transparent focus:border-gray-300 focus:bg-white rounded px-2 py-1"
                              value={row.kostengruppe}
                              onChange={(e) => handleCostRowChange(row.id, 'kostengruppe', e.target.value)}
                              placeholder="300"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              className="w-full text-sm border-transparent bg-transparent focus:border-gray-300 focus:bg-white rounded px-2 py-1 text-right font-mono"
                              value={row.amount ?? ''}
                              onChange={(e) => handleCostRowChange(row.id, 'amount', e.target.value)}
                              placeholder="0.00"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              className="w-full text-sm border-transparent bg-transparent focus:border-gray-300 focus:bg-white rounded px-2 py-1"
                              value={row.notes ?? ''}
                              onChange={(e) => handleCostRowChange(row.id, 'notes', e.target.value)}
                              placeholder="..."
                            />
                          </td>

                          <td className="p-2">
                            <select
                              className="w-full text-xs border-transparent bg-transparent focus:border-gray-300 focus:bg-white rounded px-1 py-1"
                              value={row.rowType ?? 'position'}
                              onChange={(e) => handleCostRowChange(row.id, 'rowType', e.target.value)}
                            >
                              <option value="position">Pos</option>
                              <option value="subtotal">Sub</option>
                              <option value="extra">Extra</option>
                              <option value="total">Total</option>
                            </select>
                          </td>

                          <td className="p-2 text-center">
                            <button
                              onClick={() => handleDeleteCostRow(row.id)}
                              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>

                  <tfoot className="bg-gray-50 text-xs font-medium text-gray-700">
                    <tr>
                      <td colSpan={2} className="px-4 py-2 text-right">
                        Netto
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{formatCost(subtotal)}</td>
                      <td colSpan={3} />
                    </tr>
                    <tr>
                      <td colSpan={2} className="px-4 py-2 text-right">
                        MwSt (19%)
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{formatCost(taxAmount)}</td>
                      <td colSpan={3} />
                    </tr>
                    <tr className="font-bold text-gray-900 bg-gray-100">
                      <td colSpan={2} className="px-4 py-3 text-right">
                        Gesamt
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatCost(totalWithTax)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveCostTable}
                  disabled={savingCostTable}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-50 transition"
                >
                  {savingCostTable ? 'Speichern...' : 'Tabelle speichern'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ATTACHMENTS & MESSAGES */}
        <div className="grid md:grid-cols-2 gap-6 h-[600px]">
          {/* Attachments */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
            <h2 className="font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2 flex items-center justify-between">
              <span>Anhänge</span>
            </h2>

            {/* Upload admin Drag & Drop */}
            {isAdminAm && (
              <div className="mb-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 ring-offset-1'
                      : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-700">
                      {isDragging ? <span className="text-blue-700">Datei hier ablegen!</span> : <span>Interne Datei hinzufügen (privat)</span>}
                    </div>
                    {!isDragging && (
                      <div className="text-[11px] text-gray-500 mt-1">
                        Drag & Drop oder Button nutzen. Gespeichert als <code>private</code>.
                      </div>
                    )}
                  </div>

                  <label className="inline-flex items-center px-4 py-2 text-xs font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 cursor-pointer shadow-sm transition mt-1">
                    {uploadingAttachment ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Upload läuft...
                      </span>
                    ) : (
                      'Datei auswählen'
                    )}
                    <input type="file" className="hidden" onChange={handleAdminFileInputChange} disabled={uploadingAttachment} />
                  </label>
                </div>

                {attachmentUploadError && <p className="mt-2 text-xs text-red-600 text-center">{attachmentUploadError}</p>}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {attachments.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center mt-10">Keine Dateien.</p>
              ) : (
                attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition group"
                  >
                    <span className="text-xl bg-gray-100 w-10 h-10 flex items-center justify-center rounded group-hover:bg-white transition">
                      📄
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-700 truncate group-hover:text-blue-600 transition">
                          {att.original_name}
                        </p>

                        {isAdminAm && (att as any).privacy === 'private' && (
                          <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                            Privat (Admin)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-400">{formatDateShort(att.created_at)}</p>
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>

          {/* Chat */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
            <h2 className="font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Verlauf</h2>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-10">Noch keine Nachrichten.</div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === currentUserId;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                          isMe ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                        }`}
                      >
                        <p className="whitespace-pre-line leading-relaxed">{msg.body}</p>
                        <p className={`text-[10px] mt-2 text-right ${isMe ? 'text-gray-400' : 'text-gray-500'}`}>
                          {formatDate(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2 pt-2 border-t border-gray-100">
              <input
                className="flex-1 rounded-lg border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:ring-black focus:border-black transition"
                placeholder="Nachricht..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button
                disabled={sendingMessage || !newMessage.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                Senden
              </button>
            </form>
          </div>
        </div>

        {/* (Optionnel) Admin notes – je te le laisse car tu l’avais en state,
            mais tu peux le supprimer si tu ne l’utilises plus */}
        {isAdminAm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">Interne Notizen</h2>
              <button
                onClick={handleSaveAdminNotes}
                disabled={savingAdminNotes}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50 transition"
              >
                {savingAdminNotes ? 'Speichert...' : 'Speichern'}
              </button>
            </div>

            <textarea
              className="w-full rounded-lg border-gray-300 text-sm focus:ring-black focus:border-black min-h-[110px] p-4 bg-gray-50"
              value={adminNotesDraft}
              onChange={(e) => setAdminNotesDraft(e.target.value)}
              placeholder="Interne Notizen..."
            />
          </div>
        )}
      </div>
    </main>
  );
}
