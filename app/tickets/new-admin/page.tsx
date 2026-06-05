// /app/tickets/new-admin/page.tsx

'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  FormEvent,
  ChangeEvent,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { getAdminTenanciesAction } from './actions';
import { Button, Spinner, cn } from '@/components/ui';

// --- TYPES ---

type Profile = {
  id: string;
  role: string;
  tenant_id?: string | null;
  odoo_id?: string | null;
};

type TenancyOption = {
  id: number;
  label: string;
  fullDetails: string;
  asset_id?: number | null;
  tenant_partner_id?: number | null;
  tenant_partner_name?: string | null;
  entity_id?: number | null;
  entity_name?: string | null;
  property_company?: string | null;
};

type TicketType = 'defect' | 'request';
type Priority = 'low' | 'medium' | 'high';

// --- CATEGORIES ---

const MAIN_CATEGORIES = [
  { key: 'ELEKTRO', label: 'Elektrik', icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' },
  { key: 'HKLS', label: 'Heizung/Klima', icon: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z' },
  { key: 'SANITAER', label: 'Sanitär', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'TTF', label: 'Türen/Fenster', icon: 'M3 8.25V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18V8.25m-18 0V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v2.25m-18 0h18M5.25 6h.008v.008H5.25V6zM7.5 6h.008v.008H7.5V6zm2.25 0h.008v.008H9.75V6z' },
  { key: 'BWD', label: 'Boden/Wand', icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z' },
  { key: 'SICHERHEIT', label: 'Sicherheit', icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z' },
  { key: 'AUSSEN', label: 'Außen', icon: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25' },
  { key: 'SONSTIGE', label: 'Sonstiges', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z' },
] as const;

const REQUEST_CATEGORIES = [
  { key: 'DOCUMENT', label: 'Dokument', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
  { key: 'CERTIFICATE', label: 'Bescheinigung', icon: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z' },
  { key: 'QUESTION', label: 'Frage', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z' },
  { key: 'OTHER', label: 'Sonstiges', icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];

// --- IMAGE EDITOR MODAL ---

function ImageEditorModal({
  file,
  onSave,
  onClose,
}: {
  file: File;
  onSave: (newFile: File) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      context.drawImage(img, 0, 0);
      context.lineWidth = Math.max(5, img.width / 150);
      context.lineCap = 'round';
      context.strokeStyle = '#6366f1';
      setCtx(context);
    };

    return () => { try { URL.revokeObjectURL(img.src); } catch {} };
  }, [file]);

  const getPos = (e: ReactMouseEvent | ReactTouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as ReactMouseEvent).clientX;
      clientY = (e as ReactMouseEvent).clientY;
    }
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: ReactMouseEvent | ReactTouchEvent) => {
    e.preventDefault();
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: ReactMouseEvent | ReactTouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (ctx) ctx.closePath();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const newFile = new File([blob], file.name, { type: file.type, lastModified: Date.now() });
      onSave(newFile);
    }, file.type, 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 p-4">
          <h3 className="text-lg font-semibold text-zinc-900">Bild markieren</h3>
          <button onClick={onClose} className="text-zinc-400 transition-colors hover:text-zinc-900">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-1 touch-none justify-center overflow-auto bg-zinc-100 p-4">
          <canvas
            ref={canvasRef}
            className="h-auto max-w-full cursor-crosshair bg-white"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
        <div className="flex justify-end gap-3 border-t border-zinc-100 p-4">
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleSave}>
            Speichern
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- MAIN PAGE ---

export default function NewAdminTicketPage() {
  const router = useRouter();

  // Profile & Auth
  const [profile, setProfile] = useState<Profile | null>(null);

  // Ticket Type
  const [ticketType, setTicketType] = useState<TicketType | null>(null);

  // Tenancies
  const [tenancies, setTenancies] = useState<TenancyOption[]>([]);
  const [loadingTenancies, setLoadingTenancies] = useState(false);
  const [selectedTenancyId, setSelectedTenancyId] = useState<string>('');
  const [tenancySearch, setTenancySearch] = useState('');

  // Common fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null);

  // Defect specific
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [accessRequired, setAccessRequired] = useState<boolean | null>(null);
  const [accessTimeWindow, setAccessTimeWindow] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');
  const [area, setArea] = useState('');
  const [detailedLocation, setDetailedLocation] = useState('');
  const [mainCategory, setMainCategory] = useState<string>('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [extraNotes, setExtraNotes] = useState('');

  // Request specific
  const [requestCategory, setRequestCategory] = useState<string>('');

  // State
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load profile
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.push('/auth'); return; }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single();

      if (error || !data) {
        setErrorMsg('Profil konnte nicht geladen werden.');
        return;
      }

      if (data.role !== 'admin_am') {
        router.push('/dashboard');
        return;
      }

      setProfile(data as Profile);
      if (user.email) setContactEmail(user.email);
    };
    loadProfile();
  }, [router]);

  // Load tenancies
  useEffect(() => {
    const fetchTenancies = async () => {
      if (!profile || profile.role !== 'admin_am') return;
      setLoadingTenancies(true);
      const res = await getAdminTenanciesAction();
      if (res?.success && res.data) {
        setTenancies(res.data);
      } else {
        setErrorMsg(res?.error || 'Fehler beim Laden der Objekte.');
      }
      setLoadingTenancies(false);
    };
    fetchTenancies();
  }, [profile]);

  const filteredTenancies = useMemo(() => {
    const q = tenancySearch.trim().toLowerCase();
    if (!q) return tenancies;
    return tenancies.filter((t) => (t.label || '').toLowerCase().includes(q));
  }, [tenancies, tenancySearch]);

  const selectedTenancy = useMemo(
    () => tenancies.find((t) => String(t.id) === selectedTenancyId) || null,
    [tenancies, selectedTenancyId]
  );

  // Files handling
  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));
  const startEditing = (index: number) => setEditingFileIndex(index);
  const saveEditedFile = (newFile: File) => {
    if (editingFileIndex === null) return;
    setFiles((prev) => { const next = [...prev]; next[editingFileIndex] = newFile; return next; });
    setEditingFileIndex(null);
  };

  // Submit
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!profile || profile.role !== 'admin_am') {
      setErrorMsg('Nicht autorisiert.');
      return;
    }

    if (!selectedTenancyId) {
      setErrorMsg('Bitte wählen Sie das betroffene Objekt aus.');
      return;
    }

    if (!title.trim()) {
      setErrorMsg('Bitte geben Sie einen Betreff ein.');
      return;
    }

    const tenancy = tenancies.find((t) => String(t.id) === selectedTenancyId);
    if (!tenancy) {
      setErrorMsg('Ungültige Mieteinheit.');
      return;
    }

    const odooPartnerId = tenancy.tenant_partner_id;
    if (!odooPartnerId) {
      setErrorMsg('Diese Mieteinheit hat keinen gültigen Partner.');
      return;
    }

    setLoading(true);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setErrorMsg('Nicht authentifiziert.');
      setLoading(false);
      return;
    }

    const insertData: Record<string, any> = {
      tenant_id: Number(odooPartnerId),
      odoo_tenancy_id: Number(tenancy.id),
      asset_id: tenancy.asset_id ?? null,
      created_by: user.id,
      made_by_pm: true,
      title: title.trim(),
      description: description.trim(),
      status: 'new',
      ticket_type: ticketType,
    };

    if (ticketType === 'defect') {
      insertData.priority = priority;
      insertData.contact_phone = contactPhone;
      insertData.building_section = area;
      insertData.location_description = detailedLocation;
      insertData.categories = mainCategory ? [mainCategory] : [];
      insertData.access_required = accessRequired;
      insertData.access_time_window = accessTimeWindow;
      insertData.access_instructions = accessInstructions;
      insertData.extra_contact_info = extraNotes;
    } else {
      insertData.priority = 'medium';
      insertData.categories = requestCategory ? [requestCategory] : [];
    }

    const { data: ticketData, error: insertError } = await supabase
      .from('tickets')
      .insert(insertData)
      .select()
      .single();

    if (insertError || !ticketData) {
      setErrorMsg(insertError?.message || 'Fehler beim Erstellen.');
      setLoading(false);
      return;
    }

    const ticketId = ticketData.id as string;

    // Upload files
    for (const file of files) {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${odooPartnerId}/${ticketId}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('ticket_attachments')
        .upload(path, file);

      if (!uploadError) {
        await supabase.from('ticket_attachments').insert({
          ticket_id: ticketId,
          uploaded_by: user.id,
          file_path: path,
          original_name: file.name,
          mime_type: file.type,
        });
      }
    }

    // Trigger AI for defects only
    if (ticketType === 'defect') {
      try {
        await fetch(`/api/tickets/${ticketId}/generate-report`, { method: 'POST' });
      } catch {}
    }

    setSuccessMsg('Ticket erfolgreich erstellt!');
    setTimeout(() => router.push('/backoffice/tickets'), 2000);
    setLoading(false);
  };

  const inputClass = 'w-full h-11 px-3.5 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
  const textareaClass = 'w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[100px] resize-y';

  // Loading state
  if (!profile) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-zinc-50">
        <Spinner className="h-8 w-8 text-indigo-500" />
      </main>
    );
  }

  // TYPE SELECTION
  if (!ticketType) {
    return (
      <main className="min-h-screen w-full bg-zinc-50 p-6">
        <div className="mx-auto max-w-2xl">

          {/* Header */}
          <div className="mb-10 flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900">Ticket für Mieter erstellen</h1>
              <p className="text-sm text-zinc-500">Wählen Sie den Tickettyp</p>
            </div>
          </div>

          {/* Type Cards */}
          <div className="grid gap-4">

            {/* Defect */}
            <button
              onClick={() => setTicketType('defect')}
              className="group rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm transition-all hover:border-indigo-500 hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 transition-colors group-hover:bg-indigo-100">
                  <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="mb-1 text-lg font-semibold text-zinc-900">Mangelmeldung</h2>
                  <p className="mb-3 text-sm text-zinc-500">Technischer Defekt, Schaden, Reparaturbedarf</p>
                  <ul className="space-y-1 text-xs text-zinc-400">
                    <li>• Detaillierte Kategorisierung</li>
                    <li>• Zugangsinfos & Kontaktdaten</li>
                    <li>• KI-gestützte Analyse</li>
                  </ul>
                </div>
                <svg className="h-5 w-5 text-zinc-300 transition-all group-hover:translate-x-1 group-hover:text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </button>

            {/* Request */}
            <button
              onClick={() => setTicketType('request')}
              className="group rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm transition-all hover:border-indigo-500 hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 transition-colors group-hover:bg-indigo-100">
                  <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="mb-1 text-lg font-semibold text-zinc-900">Allgemeine Anfrage</h2>
                  <p className="mb-3 text-sm text-zinc-500">Dokument, Bescheinigung, Frage</p>
                  <ul className="space-y-1 text-xs text-zinc-400">
                    <li>• Schnelles Formular</li>
                    <li>• Ohne technische Details</li>
                    <li>• Für einfache Anliegen</li>
                  </ul>
                </div>
                <svg className="h-5 w-5 text-zinc-300 transition-all group-hover:translate-x-1 group-hover:text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </button>

          </div>
        </div>
      </main>
    );
  }

  // FORM
  return (
    <main className="min-h-screen w-full bg-zinc-50 p-6">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => setTicketType(null)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">
              {ticketType === 'defect' ? 'Mangelmeldung' : 'Allgemeine Anfrage'}
            </h1>
            <p className="text-sm text-zinc-500">Ticket im Namen des Mieters erstellen</p>
          </div>
        </div>

        {/* Image Editor Modal */}
        {editingFileIndex !== null && files[editingFileIndex] && (
          <ImageEditorModal
            file={files[editingFileIndex]}
            onSave={saveEditedFile}
            onClose={() => setEditingFileIndex(null)}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Tenancy Selection */}
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Mieteinheit auswählen <span className="text-indigo-600">*</span>
            </label>
            <input
              type="text"
              placeholder="Suchen..."
              value={tenancySearch}
              onChange={(e) => setTenancySearch(e.target.value)}
              className={`${inputClass} mb-2`}
            />
            {loadingTenancies ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Spinner className="h-4 w-4 text-indigo-500" />
                Wird geladen...
              </div>
            ) : (
              <select
                value={selectedTenancyId}
                onChange={(e) => setSelectedTenancyId(e.target.value)}
                className={inputClass}
                required
              >
                <option value="">Bitte wählen...</option>
                {filteredTenancies.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Request: Category */}
          {ticketType === 'request' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">Kategorie</label>
              <div className="grid grid-cols-2 gap-2">
                {REQUEST_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setRequestCategory(cat.key)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all',
                      requestCategory === cat.key
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-zinc-200 hover:border-zinc-300'
                    )}
                  >
                    <svg className={cn('h-5 w-5', requestCategory === cat.key ? 'text-indigo-600' : 'text-zinc-400')} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                    </svg>
                    <span className={cn('text-sm font-medium', requestCategory === cat.key ? 'text-indigo-700' : 'text-zinc-700')}>
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Defect: Category */}
          {ticketType === 'defect' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">Kategorie</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MAIN_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setMainCategory(cat.key)}
                    className={cn(
                      'rounded-lg border-2 p-3 text-center transition-all',
                      mainCategory === cat.key
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-zinc-200 hover:border-zinc-300'
                    )}
                  >
                    <svg className={cn('mx-auto mb-1 h-5 w-5', mainCategory === cat.key ? 'text-indigo-600' : 'text-zinc-400')} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                    </svg>
                    <span className={cn('text-xs font-medium', mainCategory === cat.key ? 'text-indigo-700' : 'text-zinc-600')}>
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Betreff <span className="text-indigo-600">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kurze Beschreibung des Anliegens"
              className={inputClass}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detaillierte Beschreibung..."
              className={textareaClass}
            />
          </div>

          {/* Defect specific fields */}
          {ticketType === 'defect' && (
            <>
              {/* Contact */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">Telefon</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+49..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">E-Mail</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Location */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">Gebäudeteil</label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="z.B. Erdgeschoss, Lager"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">Genaue Position</label>
                  <input
                    type="text"
                    value={detailedLocation}
                    onChange={(e) => setDetailedLocation(e.target.value)}
                    placeholder="z.B. Eingangsbereich links"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Access */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">Zugang erforderlich?</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setAccessRequired(true)}
                    className={cn(
                      'flex-1 rounded-lg border-2 py-2 font-medium transition-all',
                      accessRequired === true ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
                    )}
                  >
                    Ja
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessRequired(false)}
                    className={cn(
                      'flex-1 rounded-lg border-2 py-2 font-medium transition-all',
                      accessRequired === false ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
                    )}
                  >
                    Nein
                  </button>
                </div>
                {accessRequired && (
                  <div className="mt-3 space-y-3">
                    <input
                      type="text"
                      value={accessTimeWindow}
                      onChange={(e) => setAccessTimeWindow(e.target.value)}
                      placeholder="Zeitfenster (z.B. Mo-Fr 9-17 Uhr)"
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={accessInstructions}
                      onChange={(e) => setAccessInstructions(e.target.value)}
                      placeholder="Zugangshinweise"
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">Dringlichkeit</label>
                <div className="flex gap-2">
                  {[
                    { key: 'low', label: 'Niedrig' },
                    { key: 'medium', label: 'Normal' },
                    { key: 'high', label: 'Hoch' },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPriority(p.key as Priority)}
                      className={cn(
                        'flex-1 rounded-lg border-2 py-2 font-medium transition-all',
                        priority === p.key
                          ? p.key === 'high'
                            ? 'border-red-500 bg-red-50 text-red-600'
                            : p.key === 'medium'
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                            : 'border-zinc-400 bg-zinc-50 text-zinc-700'
                          : 'border-zinc-200 text-zinc-400 hover:border-zinc-300'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Extra notes */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">Weitere Hinweise</label>
                <textarea
                  value={extraNotes}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  placeholder="Sonstige Anmerkungen..."
                  className={textareaClass}
                />
              </div>
            </>
          )}

          {/* Files */}
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Anhänge</label>
            <div className="rounded-xl border-2 border-dashed border-zinc-200 p-6 text-center">
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                  Foto
                  <input type="file" accept="image/*" capture="environment" onChange={handleFilesChange} className="hidden" />
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-zinc-50">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Dateien
                  <input type="file" multiple onChange={handleFilesChange} className="hidden" />
                </label>
              </div>
            </div>

            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between rounded-lg bg-zinc-50 p-3">
                    <span className="truncate text-sm text-zinc-700">{file.name}</span>
                    <div className="flex items-center gap-2">
                      {file.type.startsWith('image/') && (
                        <button
                          type="button"
                          onClick={() => startEditing(index)}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          Markieren
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-zinc-400 transition-colors hover:text-red-500"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Messages */}
          {errorMsg && (
            <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-700">
              {successMsg}
            </div>
          )}

          {/* Submit */}
          <Button type="submit" loading={loading} size="lg" className="w-full">
            {loading ? 'Wird erstellt...' : 'Ticket erstellen'}
          </Button>

        </form>
      </div>
    </main>
  );
}
