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

// --- TYPES ---

type Profile = {
  id: string;
  role: string; // 'tenant_user' | 'admin_am'
  tenant_id?: string | null;
  odoo_id?: string | null;
};

type TenancyOption = {
  id: number; // odoo tenancy id
  label: string;
  fullDetails: string;
  asset_id?: number | null;

  tenant_partner_id?: number | null; // res.partner.id (Odoo)
  tenant_partner_name?: string | null;

  entity_id?: number | null;
  entity_name?: string | null;

  property_company?: string | null;
};

type Priority = 'low' | 'medium' | 'high';

const MAIN_CATEGORIES = [
  { key: 'ELEKTRO', label: 'Licht & Elektrik', gewerk: 'Elektriker' },
  { key: 'HKLS', label: 'Heizung, Klima & Lüftung', gewerk: 'HKLS' },
  { key: 'SANITAER', label: 'Wasser & Sanitär', gewerk: 'Sanitärinstallateur' },
  { key: 'TTF', label: 'Türen, Tore & Fenster', gewerk: 'Schlosser / Glaser / Torbauer' },
  { key: 'BWD', label: 'Boden, Wand & Decke', gewerk: 'Maler / Bodenleger / Trockenbau' },
  { key: 'SICHERHEIT', label: 'Sicherheit & Brandschutz', gewerk: 'Spezialtechnik' },
  { key: 'AUSSEN', label: 'Außenbereich', gewerk: 'GaLa / Reinigung / Dach' },
  { key: 'SONSTIGE', label: 'Sonstiges', gewerk: 'Allgemein' },
] as const;

const SUBCATEGORY_OPTIONS: Record<string, [string, string][]> = {
  ELEKTRO: [
    ['ELEKTRO_BELEUCHTUNG_AUSGEFALLEN', 'Beleuchtung ausgefallen'],
    ['ELEKTRO_STECKDOSE_DEFEKT', 'Steckdose defekt'],
    ['ELEKTRO_SICHERUNG_SPRINGT', 'Sicherung springt raus'],
    ['ELEKTRO_KEIN_STROM', 'Kein Strom'],
  ],
  HKLS: [
    ['HKLS_ZU_KALT_WARM', 'Zu kalt / zu warm'],
    ['HKLS_KLIMA_TROPFT', 'Klimaanlage tropft'],
    ['HKLS_LUEFTUNG_LAUT_DEFEKT', 'Lüftung laut / defekt'],
    ['HKLS_UNANGENEHMER_GERUCH', 'Unangenehmer Geruch'],
    ['HKLS_HEIZUNGSAUSFALL', 'Heizungsausfall'],
  ],
  SANITAER: [
    ['SANITAER_VERSTOPFUNG', 'Verstopfung (WC/Waschbecken)'],
    ['SANITAER_WASSERHAHN_TROPFT', 'Wasserhahn tropft'],
    ['SANITAER_KEIN_WARMWASSER', 'Kein Warmwasser'],
    ['SANITAER_ROHRBRUCH', 'Rohrbruch / Wasseraustritt'],
  ],
  TTF: [
    ['TTF_AUTOMATIKTUER_OEFFNET_NICHT', 'Automatiktür öffnet nicht'],
    ['TTF_ROLLTOR_DEFEKT', 'Rolltor defekt (Warenannahme)'],
    ['TTF_SCHAUFENSTER_BESCHAEDIGT', 'Schaufenster beschädigt / Glasbruch'],
    ['TTF_SCHLOSS_KLEMMT', 'Schloss klemmt'],
    ['TTF_ZUGLUFT', 'Zugluft'],
  ],
  BWD: [
    ['BWD_FLISE_LOCKER_GEBROCHEN', 'Fliese locker / gebrochen'],
    ['BWD_BODEN_STOLPERFALLE', 'Bodenbelag Stolperfalle'],
    ['BWD_WASSERFLECK_DECKE_WAND', 'Wasserfleck an Decke / Wand'],
    ['BWD_PUTZ_BROECKELT', 'Putz bröckelt'],
  ],
  SICHERHEIT: [
    ['SICHERHEIT_SPRINKLERANLAGE', 'Sprinkleranlage'],
    ['SICHERHEIT_FEUERLOESCHER', 'Feuerlöscher fehlt / abgelaufen'],
    ['SICHERHEIT_NOTAUSGANGSLEUCHTE', 'Notausgangsleuchte defekt'],
    ['SICHERHEIT_EINBRUCHSCHADEN', 'Einbruchschaden'],
  ],
  AUSSEN: [
    ['AUSSEN_MUELL_VERSCHMUTZUNG', 'Müll / Verschmutzung'],
    ['AUSSEN_GRAFFITI', 'Graffiti'],
    ['AUSSEN_PARKPLATZBELEUCHTUNG', 'Parkplatzbeleuchtung'],
    ['AUSSEN_DACH_UNDICHT', 'Dach undicht'],
  ],
  SONSTIGE: [['SONSTIGE_ALLGEMEIN', 'Sonstiges Problem / Nicht zugeordnet']],
};

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
      context.strokeStyle = '#EF4444';
      setCtx(context);
    };

    return () => {
      try {
        URL.revokeObjectURL(img.src);
      } catch {}
    };
  }, [file]);

  const getPos = (e: ReactMouseEvent | ReactTouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number;
    let clientY: number;

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

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const newFile = new File([blob], file.name, { type: file.type, lastModified: Date.now() });
        onSave(newFile);
      },
      file.type,
      0.92
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-4xl w-full flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-lg">Bild markieren</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-black">
            ✕ Schließen
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-gray-100 flex justify-center touch-none">
          <canvas
            ref={canvasRef}
            className="max-w-full h-auto shadow-lg bg-white cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-white">
          <p className="text-xs text-gray-500 mr-auto">💡 Zeichnen Sie mit der Maus oder dem Finger auf das Bild.</p>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 font-medium">
            Abbrechen
          </button>
          <button onClick={handleSave} className="px-6 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium shadow-sm">
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// --- PAGE ---

export default function NewAdminTicketPage() {
  const router = useRouter();

  // Profile
  const [profile, setProfile] = useState<Profile | null>(null);

  // Tenancies
  const [tenancies, setTenancies] = useState<TenancyOption[]>([]);
  const [loadingTenancies, setLoadingTenancies] = useState(false);
  const [selectedTenancyId, setSelectedTenancyId] = useState<string>('');
  const [tenancySearch, setTenancySearch] = useState('');

  // Form fields
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const [accessRequired, setAccessRequired] = useState<boolean | null>(null);
  const [accessTimeWindow, setAccessTimeWindow] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [area, setArea] = useState('');
  const [detailedLocation, setDetailedLocation] = useState('');

  const [categories, setCategories] = useState<string[]>([]);
  const [mainCategory, setMainCategory] = useState<string>('');

  const [priority, setPriority] = useState<Priority>('medium');

  const [attachmentsDescription, setAttachmentsDescription] = useState('');
  const [extraContactInfo, setExtraContactInfo] = useState('');

  const [files, setFiles] = useState<File[]>([]);
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Gate admin & load profile
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single();

      if (error || !data) {
        console.error('Erreur chargement profil:', error);
        setErrorMsg('Ihr Profil kann nicht geladen werden.');
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

  // Fetch tenancies once (ALL from Odoo, already filtered server-side in actions.ts)
  useEffect(() => {
    const fetchAllTenancies = async () => {
      if (!profile || profile.role !== 'admin_am') return;

      setLoadingTenancies(true);
      const res = await getAdminTenanciesAction();

      if (res?.success && res.data) {
        setTenancies(res.data);
      } else {
        console.error('Admin Tenancies error:', res?.error);
        setErrorMsg(res?.error || 'Fehler beim Laden der Objekte.');
      }

      setLoadingTenancies(false);
    };

    fetchAllTenancies();
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

  // Files
  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
    e.target.value = '';
  };

  const removeFile = (indexToRemove: number) => setFiles((prev) => prev.filter((_, i) => i !== indexToRemove));
  const startEditing = (index: number) => setEditingFileIndex(index);

  const saveEditedFile = (newFile: File) => {
    if (editingFileIndex === null) return;
    setFiles((prev) => {
      const next = [...prev];
      next[editingFileIndex] = newFile;
      return next;
    });
    setEditingFileIndex(null);
  };

  const toggleCategory = (value: string) => {
    setCategories((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

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

  const selectedTenancy = tenancies.find((t) => String(t.id) === selectedTenancyId);
  if (!selectedTenancy) {
    setErrorMsg('Bitte wählen Sie eine gültige Mieteinheit aus.');
    return;
  }

  // ✅ tenant_id (Supabase tickets) = Odoo res.partner.id (partner_id)
  const odooPartnerId = selectedTenancy.tenant_partner_id;
  if (!odooPartnerId || Number.isNaN(Number(odooPartnerId))) {
    setErrorMsg("Diese Mieteinheit hat keinen gültigen Odoo Tenant (partner_id).");
    return;
  }

  setLoading(true);

  // Auth user (admin)
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    setErrorMsg('Benutzer nicht authentifiziert.');
    setLoading(false);
    return;
  }

  const combinedContactInfo = `Tel: ${contactPhone}\nEmail: ${contactEmail}\n${extraContactInfo}`;
  const finalDescription = description.trim();

  // 1) Create ticket
  const { data: ticketData, error: insertError } = await supabase
    .from('tickets')
    .insert({
      // ✅ IMPORTANT: tickets.tenant_id is the Odoo partner_id (int)
      tenant_id: Number(odooPartnerId),

      // ✅ tenancy id Odoo
      odoo_tenancy_id: Number(selectedTenancy.id),

      // ✅ property.property.id (from main_property_id)
      asset_id: selectedTenancy.asset_id ?? null,

      created_by: user.id,
      made_by_pm: true,

      title,
      description: finalDescription,
      priority,

      contact_phone: contactPhone,

      building_section: area,
      floor: null,
      room: null,
      location_description: detailedLocation,

      categories,

      access_required: accessRequired,
      access_time_window: accessTimeWindow,
      access_instructions: accessInstructions,

      attachments_description: attachmentsDescription,
      extra_contact_info: combinedContactInfo,

      status: 'new',
    })
    .select()
    .single();

  if (insertError || !ticketData) {
    console.error('❌ insert ticket error', insertError);
    setErrorMsg(insertError?.message || 'Fehler beim Erstellen des Tickets.');
    setLoading(false);
    return;
  }

  const ticketId = ticketData.id as string;

  // 2) Upload attachments (if any)
  let uploadedCount = 0;

  if (files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${Number(odooPartnerId)}/${ticketId}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('ticket_attachments')
        .upload(path, file);

      if (uploadError) {
        console.error('❌ upload error', file.name, uploadError);
        continue;
      }

      const { error: attachRowErr } = await supabase
        .from('ticket_attachments')
        .insert({
          ticket_id: ticketId,
          uploaded_by: user.id,
          file_path: path,
          original_name: file.name,
          mime_type: file.type,
        });

      if (attachRowErr) {
        console.error('❌ ticket_attachments insert error', attachRowErr);
        // (optionnel) continuer quand même
      } else {
        uploadedCount++;
      }
    }
  }

  // 3) Trigger IA report (best-effort)
  try {
    fetch(`/api/tickets/${ticketId}/generate-report`, { method: 'POST' }).catch((err) =>
      console.error('Erreur trigger IA (background)', err)
    );
  } catch (err) {
    console.error('Erreur réseau IA', err);
  }

  // 4) Success + reset
  setSuccessMsg(
    uploadedCount > 0
      ? `Ticket erfolgreich erstellt. ${uploadedCount} Datei(en) hochgeladen.`
      : 'Ticket erfolgreich erstellt.'
  );

  setContactPhone('');
  setTitle('');
  setDescription('');
  setArea('');
  setDetailedLocation('');
  setMainCategory('');
  setCategories([]);
  setPriority('medium');
  setAccessRequired(null);
  setAccessTimeWindow('');
  setAccessInstructions('');
  setAttachmentsDescription('');
  setExtraContactInfo('');
  setFiles([]);

  setLoading(false);

  setTimeout(() => {
    router.push('/dashboard');
  }, 1200);
};


  return (
    <main className="min-h-screen w-full bg-gray-100 flex items-start justify-center p-6 text-gray-900">
      {editingFileIndex !== null && (
        <ImageEditorModal file={files[editingFileIndex]} onSave={saveEditedFile} onClose={() => setEditingFileIndex(null)} />
      )}

      <div className="w-full max-w-3xl bg-white rounded-xl shadow-sm border border-gray-300 p-8 space-y-8">
        <header className="border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-semibold text-gray-900">Neues Ticket — Admin</h1>
          <p className="text-sm text-gray-600 mt-2">
            Ticket als Admin erstellen (Odoo Tenancy + Partner ID sichtbar).
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* --- 1. OBJEKT (ODOO) --- */}
          <section className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-3">
            <h2 className="font-semibold text-lg text-gray-900">1. Betroffenes Objekt</h2>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Suche (Client-side)</label>
              <input
                type="text"
                value={tenancySearch}
                onChange={(e) => setTenancySearch(e.target.value)}
                className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2"
                placeholder="z.B. Name, Stadt, Straße, ID…"
              />
              <p className="text-xs text-gray-500 mt-1">
                Angezeigt: {filteredTenancies.length} / {tenancies.length}
              </p>
            </div>

            {loadingTenancies ? (
              <p className="text-sm text-gray-500 animate-pulse">Lade Objekte...</p>
            ) : filteredTenancies.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Bitte wählen Sie die Mieteinheit *
                </label>
                <select
                  value={selectedTenancyId}
                  onChange={(e) => setSelectedTenancyId(e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2"
                  required
                >
                  <option value="">-- Bitte wählen --</option>
                  {filteredTenancies.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>

                {selectedTenancy && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 space-y-1">
                    <div>
                      <span className="font-semibold">Tenancy ID (Odoo):</span> {selectedTenancy.id}
                    </div>
                    <div>
                      <span className="font-semibold">Tenant Partner ID (Odoo res.partner):</span>{' '}
                      {selectedTenancy.tenant_partner_id ?? '—'}
                    </div>
                    <div>
                      <span className="font-semibold">Tenant Partner Name:</span>{' '}
                      {selectedTenancy.tenant_partner_name ?? '—'}
                    </div>
                    <div>
                      <span className="font-semibold">Entity:</span> {selectedTenancy.entity_name ?? '—'} (
                      {selectedTenancy.entity_id ?? '—'})
                    </div>
                    <div>
                      <span className="font-semibold">Company:</span> {selectedTenancy.property_company ?? '—'}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-amber-700 font-medium">Keine Objekte gefunden.</div>
            )}
          </section>

          {/* --- 2. KONTAKTDATEN --- */}
          <section className="space-y-4">
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">2. Kontaktdaten</h2>
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Telefonnummer</label>
                <input
                  type="text"
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+49..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">E-Mail Adresse</label>
                <input
                  type="email"
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="name@firma.de"
                />
              </div>
            </div>
          </section>

          {/* --- 3. ZUGANG --- */}
          <section className="space-y-4">
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">3. Verfügbarkeit & Zugang</h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">Ist Zugang zur Mietfläche erforderlich?</p>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="access_required"
                      checked={accessRequired === true}
                      onChange={() => setAccessRequired(true)}
                      className="text-black focus:ring-black"
                    />
                    <span className="text-gray-900">Ja</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="access_required"
                      checked={accessRequired === false}
                      onChange={() => setAccessRequired(false)}
                      className="text-black focus:ring-black"
                    />
                    <span className="text-gray-900">Nein</span>
                  </label>
                </div>
              </div>

              {accessRequired !== false && (
                <div className="grid md:grid-cols-1 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Zeitfenster für Zugang</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2"
                      value={accessTimeWindow}
                      onChange={(e) => setAccessTimeWindow(e.target.value)}
                      placeholder="z. B. Mo–Fr 8:00–12:00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Zutrittsregelungen / Schlüssel / Ansprechpartner vor Ort
                    </label>
                    <textarea
                      className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2 min-h-[60px]"
                      value={accessInstructions}
                      onChange={(e) => setAccessInstructions(e.target.value)}
                      placeholder="z.B. Schlüssel beim Empfang, rufen Sie Frau Müller an..."
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* --- 4. BESCHREIBUNG --- */}
          <section className="space-y-4">
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">4. Beschreibung des Mangels</h2>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Titel / Kurzerfassung *</label>
              <input
                type="text"
                className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="z.B. Heizungsausfall im Showroom"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Ausführliche Beschreibung *
                <span className="block text-xs text-gray-500 font-normal mt-0.5">(Was? Wo genau? Seit wann? Welche Auswirkungen?)</span>
              </label>
              <textarea
                className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2 min-h-[120px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
          </section>

          {/* --- 5. LAGE --- */}
          <section className="space-y-4">
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">5. Lage des Mangels</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Bereich *</label>
                <select
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  required
                >
                  <option value="">-- Bitte wählen --</option>
                  <option value="Verkaufsfläche (Showroom)">Verkaufsfläche (Showroom)</option>
                  <option value="Schaufenster / Fassade">Schaufenster / Fassade</option>
                  <option value="Eingangsbereich / Automatiktüren">Eingangsbereich / Automatiktüren</option>
                  <option value="Lager / Warenannahme">Lager / Warenannahme</option>
                  <option value="Personalräume / Büro / Küche">Personalräume / Büro / Küche</option>
                  <option value="Sanitäranlagen (Kunden)">Sanitäranlagen (Kunden)</option>
                  <option value="Sanitäranlagen (Personal)">Sanitäranlagen (Personal)</option>
                  <option value="Parkplatz / Außenbereich">Parkplatz / Außenbereich</option>
                  <option value="Technikraum / Keller">Technikraum / Keller</option>
                  <option value="Dach">Dach</option>
                  <option value="Sonstige">Sonstiges</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Detaillierte Ortsangabe
                  <span className="block text-xs text-gray-500 font-normal mt-0.5">
                    Bitte beschreiben Sie die genaue Stelle (z.B. &quot;Über Kasse 2&quot;, &quot;Damen-WC Kabine links&quot;, &quot;Laderampe Tor 3&quot;).
                  </span>
                </label>
                <textarea
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2 min-h-[60px]"
                  value={detailedLocation}
                  onChange={(e) => setDetailedLocation(e.target.value)}
                  placeholder="z. B. Über Kasse 2, linke Kabine, Laderampe Tor 3..."
                />
              </div>
            </div>
          </section>

          {/* --- 6. KATEGORIE --- */}
          <section className="space-y-4">
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">6. Was ist betroffen? (Kategorie-Auswahl)</h2>
            <p className="text-xs text-gray-600">Wählen Sie zuerst die passende Kategorie aus. Danach können Sie das konkrete Problem auswählen.</p>

            <div className="space-y-4 bg-gray-50 p-5 rounded-xl border border-gray-200 text-sm">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Hauptkategorie *</label>
                <select
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2"
                  value={mainCategory}
                  onChange={(e) => {
                    setMainCategory(e.target.value);
                    setCategories([]);
                  }}
                  required
                >
                  <option value="">-- Bitte wählen --</option>
                  {MAIN_CATEGORIES.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {mainCategory ? (
                <div className="border-t border-gray-200 pt-4">
                  <p className="font-semibold text-gray-900 mb-2">Konkretes Problem</p>
                  <p className="text-xs text-gray-500 mb-2">Sie können mehrere Optionen auswählen, falls mehrere Punkte betroffen sind.</p>

                  <div className="grid md:grid-cols-2 gap-2 pl-1">
                    {(SUBCATEGORY_OPTIONS[mainCategory] || []).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded transition">
                        <input
                          type="checkbox"
                          checked={categories.includes(value)}
                          onChange={() => toggleCategory(value)}
                          className="rounded border-gray-400 text-black focus:ring-black"
                        />
                        <span className="text-gray-800">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">Bitte wählen Sie zuerst eine Hauptkategorie aus.</p>
              )}
            </div>
          </section>

          {/* --- 7. DRINGLICHKEIT --- */}
          <section className="space-y-4">
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">7. Betriebsrelevanz / Dringlichkeit</h2>
            <div className="space-y-3 text-sm bg-gray-50 p-5 rounded-xl border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  checked={priority === 'high'}
                  onChange={() => setPriority('high')}
                  className="text-red-600 focus:ring-red-600"
                />
                <span className="font-bold text-red-700">Hoch – Geschäftsbetrieb erheblich gestört oder Sicherheitsrisiko</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  checked={priority === 'medium'}
                  onChange={() => setPriority('medium')}
                  className="text-black focus:ring-black"
                />
                <span className="text-gray-900">Mittel – Funktionseinschränkung, Betrieb aber möglich</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  checked={priority === 'low'}
                  onChange={() => setPriority('low')}
                  className="text-black focus:ring-black"
                />
                <span className="text-gray-900">Niedrig – optischer Mangel / kein Einfluss auf Betrieb</span>
              </label>
            </div>
          </section>

          {/* --- 8. UPLOADS --- */}
          <section className="space-y-4">
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">8. Anlagen / Uploads</h2>

            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg shadow-sm">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3 text-sm text-blue-900">
                  <p className="font-bold mb-1">Wichtige Foto-Hinweise:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>
                      Bitte machen Sie mindestens ein <strong>Gesamtfoto</strong> (Raum) und ein <strong>Detailfoto</strong> (Schaden).
                    </li>
                    <li>Fotografieren Sie bitte das <strong>Typenschild (Plakette)</strong> oder Wartungsaufkleber am Gerät/Anlage, falls vorhanden.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Beschreibung der Fotos / Dateien</label>
              <textarea
                className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2 min-h-[60px]"
                value={attachmentsDescription}
                onChange={(e) => setAttachmentsDescription(e.target.value)}
                placeholder="Beschreiben Sie hier kurz, was auf den Bildern zu sehen ist..."
              />
            </div>

            <div
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition ${
                files.length === 0 ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="flex flex-col sm:flex-row gap-4 w-full justify-center items-center">
                <label className="cursor-pointer bg-black text-white px-5 py-3 rounded-lg shadow-md hover:bg-gray-800 active:scale-95 transition flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Foto aufnehmen</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleFilesChange} className="hidden" />
                </label>

                <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-5 py-3 rounded-lg shadow-sm hover:bg-gray-50 active:scale-95 transition flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Dateien auswählen</span>
                  <input type="file" multiple onChange={handleFilesChange} className="hidden" />
                </label>
              </div>

              <p className="text-xs text-gray-500 mt-4">(Alle Dateitypen erlaubt: Bilder, Videos, PDF...)</p>
            </div>

            {files.length > 0 && (
              <div className="space-y-2 bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ausgewählte Dateien ({files.length})</p>
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="truncate text-gray-700 font-medium">{file.name}</span>
                      <span className="text-xs text-gray-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {file.type.startsWith('image/') && (
                        <button
                          type="button"
                          onClick={() => startEditing(index)}
                          className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded transition flex items-center gap-1"
                        >
                          ✎ Markieren
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700 font-bold px-2 py-1 hover:bg-red-50 rounded transition"
                        title="Entfernen"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {files.length === 0 && (
              <div className="rounded-lg bg-red-100 border-l-4 border-red-600 p-4 mt-2 animate-pulse">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-bold text-red-800 uppercase">Achtung: Keine Dateien!</h3>
                    <div className="mt-1 text-sm text-red-700 font-semibold">
                      Ohne Fotos, Videos oder Dokumente können wir Ihre Anfrage möglicherweise nicht effizient oder gar nicht bearbeiten.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* --- 9. HINWEISE --- */}
          <section className="space-y-4">
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">9. Weitere Hinweise</h2>
            <textarea
              className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2 min-h-[80px]"
              value={extraContactInfo}
              onChange={(e) => setExtraContactInfo(e.target.value)}
              placeholder="Sonstige Anmerkungen..."
            />
          </section>

          {errorMsg && (
            <div className="p-4 bg-red-50 text-red-900 border border-red-200 rounded-lg text-sm font-medium whitespace-pre-line">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-4 bg-green-50 text-green-900 border border-green-200 rounded-lg text-sm font-medium text-center">
              {successMsg}
              <p className="text-xs text-green-700 mt-1">Sie werden weitergeleitet...</p>
            </div>
          )}

          <div className="flex justify-end pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading || !profile}
              className="bg-gray-900 text-white px-8 py-3.5 rounded-xl font-medium shadow-md hover:bg-gray-800 transition transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 text-base"
            >
              {loading ? 'Wird erstellt...' : 'Ticket erstellen'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
