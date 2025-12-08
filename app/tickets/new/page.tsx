'use client';

import {
  useEffect,
  useState,
  useRef,
  FormEvent,
  ChangeEvent,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent
} from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { getTenanciesAction } from './actions';

// --- TYPES ---

type Profile = {
  id: string;
  tenant_id: string;
  odoo_id: string | null;
  role: string;
};

type TenancyOption = {
  id: number;
  label: string;
  fullDetails: string;
  asset_id?: number | null;
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
};

// --- COMPOSANT MODAL D'ÉDITION D'IMAGE ---
function ImageEditorModal({ file, onSave, onClose }: { file: File, onSave: (newFile: File) => void, onClose: () => void }) {
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
      context.strokeStyle = '#EF4444'; // Red-500
      setCtx(context);
    };
  }, [file]);

  const getPos = (e: ReactMouseEvent | ReactTouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as ReactMouseEvent).clientX;
      clientY = (e as ReactMouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
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
      if (blob) {
        const newFile = new File([blob], file.name, { type: file.type, lastModified: Date.now() });
        onSave(newFile);
      }
    }, file.type);
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
           <p className="text-xs text-gray-500 mr-auto flex items-center">
             💡 Zeichnen Sie mit der Maus oder dem Finger auf das Bild.
           </p>
           <button 
             onClick={onClose}
             className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
           >
             Abbrechen
           </button>
           <button 
             onClick={handleSave}
             className="px-6 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium shadow-sm"
           >
             Speichern
           </button>
        </div>
      </div>
    </div>
  );
}


// --- MAIN PAGE ---

export default function NewTicketPage() {
  const router = useRouter();

  // --- States User & Odoo ---
  const [profile, setProfile] = useState<Profile | null>(null);

  const [tenancies, setTenancies] = useState<TenancyOption[]>([]);
  const [loadingTenancies, setLoadingTenancies] = useState(false);
  const [selectedTenancyId, setSelectedTenancyId] = useState<string>('');

  // --- Champs formulaire ---
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const [accessRequired, setAccessRequired] = useState<boolean | null>(null);
  const [accessTimeWindow, setAccessTimeWindow] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // --- Punkt 5: Lage ---
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

  // 1. Charger le profil
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push('/sign-in');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        console.error(profileError);
        setErrorMsg('Ihr Profil kann nicht geladen werden.');
        return;
      }

      setProfile(profileData);
      if (user.email) setContactEmail(user.email);
    };

    loadProfile();
  }, [router]);

  // 2. Charger les Tenancies (Odoo)
  useEffect(() => {
    const fetchTenancies = async () => {
      if (!profile?.odoo_id) return;

      setLoadingTenancies(true);
      const res = await getTenanciesAction(profile.odoo_id);

      if (res.success && res.data) {
        setTenancies(res.data);
        if (res.data.length === 1) {
          setSelectedTenancyId(String(res.data[0].id));
        }
      } else {
        console.error("Odoo error:", res.error);
      }
      setLoadingTenancies(false);
    };

    fetchTenancies();
  }, [profile?.odoo_id]);

  // --- GESTION FICHIERS ---

  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
    e.target.value = '';
  };

  const removeFile = (indexToRemove: number) => {
    setFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const startEditing = (index: number) => {
    setEditingFileIndex(index);
  };

  const saveEditedFile = (newFile: File) => {
    if (editingFileIndex === null) return;
    setFiles((prev) => {
      const newFiles = [...prev];
      newFiles[editingFileIndex] = newFile;
      return newFiles;
    });
    setEditingFileIndex(null);
  };

  // ------------------------

  const toggleCategory = (value: string) => {
    setCategories((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!profile) {
      setErrorMsg('Profil nicht geladen.');
      return;
    }

    if (tenancies.length > 0 && !selectedTenancyId) {
      setErrorMsg("Bitte wählen Sie das betroffene Objekt aus.");
      return;
    }

    setLoading(true);

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMsg('Benutzer nicht authentifiziert.');
      setLoading(false);
      return;
    }

    const finalDescription = description.trim();
    const combinedContactInfo = `Tel: ${contactPhone}\nEmail: ${contactEmail}\n${extraContactInfo}`;
    const selectedTenancy = tenancies.find(
      (t) => String(t.id) === selectedTenancyId
    );

    // 1) Création du ticket
    const { data: ticketData, error: insertError } = await supabase
      .from('tickets')
      .insert({
        tenant_id: profile.tenant_id,
        odoo_tenancy_id: selectedTenancyId ? parseInt(selectedTenancyId) : null,
        asset_id: selectedTenancy?.asset_id ?? null,
        created_by: user.id,
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
        status: 'new'
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
    let uploadedCount = 0;

    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `${profile.tenant_id}/${ticketId}/${Date.now()}-${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from('ticket_attachments')
          .upload(path, file);

        if (uploadError) {
          console.error('❌ upload error', file.name, uploadError);
          continue;
        }

        await supabase
          .from('ticket_attachments')
          .insert({
            ticket_id: ticketId,
            uploaded_by: user.id,
            file_path: path,
            original_name: file.name,
            mime_type: file.type,
          });

        uploadedCount++;
      }
    }

    try {
      fetch(`/api/tickets/${ticketId}/generate-report`, { method: 'POST' })
        .catch(err => console.error('Erreur trigger IA (background)', err));
    } catch (e) {
      console.error('Erreur réseau IA', e);
    }

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
    }, 2000);
  };

  // --- RENDU UI ---
  return (
    <main className="min-h-screen w-full bg-gray-100 flex items-start justify-center p-6 text-gray-900">
      
      {/* MODAL EDIT */}
      {editingFileIndex !== null && (
        <ImageEditorModal
          file={files[editingFileIndex]}
          onSave={saveEditedFile}
          onClose={() => setEditingFileIndex(null)}
        />
      )}

      <div className="w-full max-w-3xl bg-white rounded-xl shadow-sm border border-gray-300 p-8 space-y-8">

        <header className="border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-semibold text-gray-900">
            Neues Ticket — Mangelmeldung
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            Bitte füllen Sie das Formular vollständig aus.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* --- 1. OBJEKT (ODOO) --- */}
          <section className="bg-gray-50 p-5 rounded-xl border border-gray-200">
            <h2 className="font-semibold text-lg text-gray-900 mb-3">
              1. Betroffenes Objekt
            </h2>
            {loadingTenancies ? (
              <p className="text-sm text-gray-500 animate-pulse">Lade Objekte...</p>
            ) : tenancies.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Bitte wählen Sie Ihre Mieteinheit
                </label>
                <select
                  value={selectedTenancyId}
                  onChange={(e) => setSelectedTenancyId(e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2"
                  required
                >
                  <option value="">-- Bitte wählen --</option>
                  {tenancies.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-sm text-amber-700 font-medium">
                Keine Objekte gefunden (Odoo ID: {profile?.odoo_id || 'Nicht verknüpft'}).
                <br />Bitte fahren Sie fort, wir ordnen das Ticket manuell zu.
              </div>
            )}
          </section>

          {/* --- 2. KONTAKTDATEN --- */}
          <section className="space-y-4">
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">
              2. Kontaktdaten
            </h2>
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Telefonnummer
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+49..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  E-Mail Adresse
                </label>
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
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">
              3. Verfügbarkeit & Zugang
            </h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  Ist Zugang zur Mietfläche erforderlich?
                </p>
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
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Zeitfenster für Zugang
                    </label>
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
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">
              4. Beschreibung des Mangels
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Titel / Kurzerfassung *
              </label>
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
                <span className="block text-xs text-gray-500 font-normal mt-0.5">
                  (Was? Wo genau? Seit wann? Welche Auswirkungen?)
                </span>
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
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">
              5. Lage des Mangels
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Bereich *
                </label>
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
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">
              6. Was ist betroffen? (Kategorie-Auswahl)
            </h2>
            <p className="text-xs text-gray-600">
              Wählen Sie zuerst die passende Kategorie aus. Danach können Sie das konkrete Problem auswählen.
            </p>

            <div className="space-y-4 bg-gray-50 p-5 rounded-xl border border-gray-200 text-sm">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Hauptkategorie *
                </label>
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
                {mainCategory && (
                  <p className="text-xs text-gray-500 mt-1">
                    Gewerk (intern):{' '}
                    {MAIN_CATEGORIES.find((c) => c.key === mainCategory)?.gewerk}
                  </p>
                )}
              </div>

              {mainCategory && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="font-semibold text-gray-900 mb-2">
                    Konkretes Problem
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    Sie können mehrere Optionen auswählen, falls mehrere Punkte betroffen sind.
                  </p>

                  <div className="grid md:grid-cols-2 gap-2 pl-1">
                    {(SUBCATEGORY_OPTIONS[mainCategory] || []).map(([value, label]) => (
                      <label
                        key={value}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded transition"
                      >
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
              )}

              {!mainCategory && (
                <p className="text-xs text-gray-500">
                  Bitte wählen Sie zuerst eine Hauptkategorie aus.
                </p>
              )}
            </div>
          </section>

          {/* --- 7. DRINGLICHKEIT --- */}
          <section className="space-y-4">
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">
              7. Betriebsrelevanz / Dringlichkeit
            </h2>

            <div className="space-y-3 text-sm bg-gray-50 p-5 rounded-xl border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  checked={priority === 'high'}
                  onChange={() => setPriority('high')}
                  className="text-red-600 focus:ring-red-600"
                />
                <span className="font-bold text-red-700">
                  Hoch – Geschäftsbetrieb erheblich gestört oder Sicherheitsrisiko
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  checked={priority === 'medium'}
                  onChange={() => setPriority('medium')}
                  className="text-black focus:ring-black"
                />
                <span className="text-gray-900">
                  Mittel – Funktionseinschränkung, Betrieb aber möglich
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  checked={priority === 'low'}
                  onChange={() => setPriority('low')}
                  className="text-black focus:ring-black"
                />
                <span className="text-gray-900">
                  Niedrig – optischer Mangel / kein Einfluss auf Betrieb
                </span>
              </label>
            </div>
          </section>

          {/* --- 8. ANLAGEN / UPLOADS (MODIFIÉ) --- */}
          <section className="space-y-4">
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">
              8. Anlagen / Uploads
            </h2>

            {/* INFO BOX BLEUE */}
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
                    <li>Bitte machen Sie mindestens ein <strong>Gesamtfoto</strong> (Raum) und ein <strong>Detailfoto</strong> (Schaden).</li>
                    <li>
                      <strong>Sehr wichtig:</strong> Fotografieren Sie bitte das <strong>Typenschild (Plakette)</strong> oder Wartungsaufkleber am Gerät/Anlage, falls vorhanden.
                    </li>
                  </ul>
                  <p className="mt-2 text-xs text-blue-700">
                    (Dies hilft uns, sofort die richtige Wartungsfirma zu beauftragen.)
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Beschreibung der Fotos / Dateien
              </label>
              <textarea
                className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2 min-h-[60px]"
                value={attachmentsDescription}
                onChange={(e) => setAttachmentsDescription(e.target.value)}
                placeholder="Beschreiben Sie hier kurz, was auf den Bildern zu sehen ist..."
              />
            </div>

            {/* Zone d'upload avec DEUX BOUTONS */}
            <div className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition ${
               files.length === 0 ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
            }`}>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full justify-center items-center">
                
                {/* BOUTON 1: APPAREIL PHOTO (MOBILE) */}
                <label className="cursor-pointer bg-black text-white px-5 py-3 rounded-lg shadow-md hover:bg-gray-800 active:scale-95 transition flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Foto aufnehmen</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment" // <-- C'est ça qui déclenche la caméra arrière
                    onChange={handleFilesChange}
                    className="hidden"
                  />
                </label>

                {/* BOUTON 2: GALERIE / FICHIERS */}
                <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-5 py-3 rounded-lg shadow-sm hover:bg-gray-50 active:scale-95 transition flex items-center gap-2">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Dateien auswählen</span>
                  <input
                    type="file"
                    multiple
                    // Pas de 'capture' ici, donc ouvre le navigateur de fichiers
                    onChange={handleFilesChange}
                    className="hidden"
                  />
                </label>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                (Alle Dateitypen erlaubt: Bilder, Videos, PDF...)
              </p>
            </div>

            {/* LISTE DES FICHIERS & BOUTON ÉDITER */}
            {files.length > 0 && (
              <div className="space-y-2 bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Ausgewählte Dateien ({files.length})
                </p>
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="truncate text-gray-700 font-medium">
                        {file.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* BOUTON MARQUER (Seulement pour les images) */}
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

            {/* Message d'erreur ROUGE si vide */}
            {files.length === 0 && (
              <div className="rounded-lg bg-red-100 border-l-4 border-red-600 p-4 mt-2 animate-pulse">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-bold text-red-800 uppercase">
                      Achtung: Keine Dateien!
                    </h3>
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
            <h2 className="font-semibold text-lg text-gray-900 border-b border-gray-200 pb-2">
              9. Weitere Hinweise
            </h2>
            <textarea
              className="w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-black focus:ring-black px-3 py-2 min-h-[80px]"
              value={extraContactInfo}
              onChange={(e) => setExtraContactInfo(e.target.value)}
              placeholder="Sonstige Anmerkungen..."
            />
          </section>

          {/* --- MESSAGES D'ERREUR/SUCCÈS --- */}
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

          {/* --- BOUTON SUBMIT --- */}
          <div className="flex justify-end pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading || !profile}
              className="bg-gray-900 text-white px-8 py-3.5 rounded-xl font-medium shadow-md hover:bg-gray-800 transition transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 text-base"
            >
              {loading && (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? 'Wird erstellt...' : 'Ticket erstellen'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}