// /app/tickets/new/defect/page.tsx — public Mangelmeldung (no account).

'use client';

import {
  useState,
  useRef,
  useEffect,
  FormEvent,
  ChangeEvent,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from 'react';
import Link from 'next/link';
import {
  identifyTenantAction,
  createTicketAction,
  type TenancyOption,
} from '../actions';
import { Button, Card, Input, Textarea, Select, Field, Spinner, cn } from '../../../../components/ui';

type Priority = 'low' | 'medium' | 'high';

const MAIN_CATEGORIES = [
  { key: 'ELEKTRO', label: 'Licht & Elektrik', icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' },
  { key: 'HKLS', label: 'Heizung, Klima & Lüftung', icon: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z' },
  { key: 'SANITAER', label: 'Wasser & Sanitär', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'TTF', label: 'Türen, Tore & Fenster', icon: 'M3 8.25V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18V8.25m-18 0V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v2.25m-18 0h18M5.25 6h.008v.008H5.25V6zM7.5 6h.008v.008H7.5V6zm2.25 0h.008v.008H9.75V6z' },
  { key: 'BWD', label: 'Boden, Wand & Decke', icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z' },
  { key: 'SICHERHEIT', label: 'Sicherheit & Brandschutz', icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z' },
  { key: 'AUSSEN', label: 'Außenbereich', icon: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25' },
  { key: 'SONSTIGE', label: 'Sonstiges', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z' },
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

/* -------------------------------------------------------------------------- */
/*  Image markup modal                                                        */
/* -------------------------------------------------------------------------- */
function ImageEditorModal({ file, onSave, onClose }: { file: File; onSave: (f: File) => void; onClose: () => void }) {
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
      context.strokeStyle = '#4f46e5';
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
      if (blob) onSave(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
    }, file.type);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h3 className="font-semibold text-zinc-900">Bild markieren</h3>
          <button onClick={onClose} className="text-zinc-400 transition-colors hover:text-zinc-900">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-1 touch-none justify-center overflow-auto bg-zinc-100 p-4">
          <canvas
            ref={canvasRef}
            className="h-auto max-w-full cursor-crosshair bg-white shadow-lg"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
        <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-4">
          <p className="text-sm text-zinc-400">Zeichnen Sie mit Maus oder Finger auf das Bild.</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
            <Button onClick={handleSave}>Speichern</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section heading                                                           */
/* -------------------------------------------------------------------------- */
function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 text-sm font-semibold text-zinc-900">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-xs text-white">{n}</span>
      {children}
    </h2>
  );
}

// Vorschau einer ausgewählten Datei: Miniatur bei Bildern, sonst Icon.
function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file.type.startsWith('image/')) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={file.name} className="h-10 w-10 flex-shrink-0 rounded-md object-cover" />;
  }
  return (
    <svg className="h-4 w-4 flex-shrink-0 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */
export default function NewDefectPage() {
  const [step, setStep] = useState<'identify' | 'form' | 'done'>('identify');

  // Identify
  const [odooId, setOdooId] = useState('');
  const [plz, setPlz] = useState('');
  const [identifying, setIdentifying] = useState(false);
  const [identifyError, setIdentifyError] = useState<string | null>(null);
  const [tenancies, setTenancies] = useState<TenancyOption[]>([]);
  const [selectedTenancyId, setSelectedTenancyId] = useState('');

  // Contact
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Access
  const [accessRequired, setAccessRequired] = useState<boolean | null>(null);
  const [accessTimeWindow, setAccessTimeWindow] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');

  // Problem
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('');
  const [detailedLocation, setDetailedLocation] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [mainCategory, setMainCategory] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [attachmentsDescription, setAttachmentsDescription] = useState('');
  const [extraContactInfo, setExtraContactInfo] = useState('');

  // Files
  const [files, setFiles] = useState<File[]>([]);
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleIdentify = async (e: FormEvent) => {
    e.preventDefault();
    setIdentifying(true);
    setIdentifyError(null);
    const res = await identifyTenantAction(odooId, plz);
    if (res.success) {
      setTenancies(res.tenancies);
      if (res.tenancies.length === 1) setSelectedTenancyId(String(res.tenancies[0].id));
      setStep('form');
    } else {
      setIdentifyError(res.error);
    }
    setIdentifying(false);
  };

  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = '';
  };
  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));
  const saveEditedFile = (newFile: File) => {
    if (editingFileIndex === null) return;
    setFiles((prev) => {
      const next = [...prev];
      next[editingFileIndex] = newFile;
      return next;
    });
    setEditingFileIndex(null);
  };
  const toggleCategory = (v: string) =>
    setCategories((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!selectedTenancyId) {
      setSubmitError('Bitte wählen Sie das betroffene Objekt aus.');
      return;
    }
    if (!title.trim() || !description.trim()) {
      setSubmitError('Bitte geben Sie Titel und Beschreibung ein.');
      return;
    }
    if (files.length === 0) {
      const proceed = window.confirm(
        'Sie haben kein Foto oder Dokument hinzugefügt.\n\n' +
          'Mit Fotos können wir Ihr Anliegen deutlich schneller und genauer bearbeiten. ' +
          'Falls Sie z. B. einen Kostenvoranschlag oder die Visitenkarte/Plakette eines Handwerkers haben, fügen Sie diese bitte bei.\n\n' +
          'Möchten Sie trotzdem ohne Foto fortfahren?'
      );
      if (!proceed) return;
    }
    setSubmitting(true);

    const selTen = tenancies.find((t) => String(t.id) === selectedTenancyId);
    const fd = new FormData();
    fd.set('ticket_type', 'defect');
    fd.set('odoo_tenancy_id', selectedTenancyId || '');
    fd.set('plz', plz);
    fd.set('asset_id', selTen?.asset_id != null ? String(selTen.asset_id) : '');
    fd.set('title', title);
    fd.set('description', description);
    fd.set('priority', priority);
    fd.set('categories', JSON.stringify(categories));
    fd.set('contact_name', contactName);
    fd.set('contact_email', contactEmail);
    fd.set('contact_phone', contactPhone);
    fd.set('building_section', area);
    fd.set('location_description', detailedLocation);
    fd.set('access_required', accessRequired === null ? '' : String(accessRequired));
    fd.set('access_time_window', accessTimeWindow);
    fd.set('access_instructions', accessInstructions);
    fd.set('attachments_description', attachmentsDescription);
    fd.set('extra_contact_info', extraContactInfo);
    for (const f of files) fd.append('files', f);

    const res = await createTicketAction(fd);
    if (res.success) {
      setTrackingCode(res.trackingCode);
      // Fire AI cost-analysis in the background (browser keeps the request alive).
      fetch(`/api/tickets/${res.ticketId}/generate-report`, { method: 'POST' }).catch(() => {});
      setStep('done');
    } else {
      setSubmitError(res.error);
    }
    setSubmitting(false);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  /* ----- DONE ----- */
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-zinc-50">
        <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-16 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Mangel erfolgreich gemeldet</h1>
          <p className="mt-2 text-zinc-500">
            Bewahren Sie diesen Tracking-Code auf, um den Status Ihres Tickets zu verfolgen.
          </p>

          <button
            onClick={copyCode}
            className="group mt-6 flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm transition-colors hover:border-zinc-300"
          >
            <span className="font-mono text-xl font-semibold tracking-wider text-zinc-900">{trackingCode}</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600">
              {copied ? (
                'Kopiert!'
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                  </svg>
                  Kopieren
                </>
              )}
            </span>
          </button>

          <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row">
            <Link href={`/tickets/track`} className="flex-1">
              <Button className="w-full">Ticket verfolgen</Button>
            </Link>
            <Link href="/" className="flex-1">
              <Button variant="secondary" className="w-full">Zur Startseite</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {editingFileIndex !== null && (
        <ImageEditorModal
          file={files[editingFileIndex]}
          onSave={saveEditedFile}
          onClose={() => setEditingFileIndex(null)}
        />
      )}

      {/* Top bar */}
      <header className="border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-6">
          <Link href="/tickets/new" className="flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Zurück
          </Link>
          <span className="text-sm text-zinc-400">Mangelmeldung</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {/* ----- IDENTIFY ----- */}
        {step === 'identify' && (
          <div className="mx-auto max-w-md">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Identifikation</h1>
              <p className="mt-2 text-zinc-500">
                Bitte geben Sie Ihre Mieter-ID und die Postleitzahl des Objekts ein.
              </p>
            </div>
            <Card className="p-6">
              <form onSubmit={handleIdentify} className="space-y-4">
                <Field label="Mieter-ID" required>
                  <Input
                    value={odooId}
                    onChange={(e) => setOdooId(e.target.value)}
                    placeholder="z. B. 12345"
                    inputMode="numeric"
                    autoFocus
                    required
                  />
                </Field>
                <Field label="Postleitzahl des Objekts" required>
                  <Input
                    value={plz}
                    onChange={(e) => setPlz(e.target.value)}
                    placeholder="z. B. 06847"
                    inputMode="numeric"
                    required
                  />
                </Field>
                {identifyError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                    {identifyError}
                  </div>
                )}
                <Button type="submit" loading={identifying} className="w-full">
                  Weiter
                </Button>
              </form>
            </Card>
            <p className="mt-4 text-center text-sm text-zinc-400">
              Keine ID? Wenden Sie sich an Ihre Hausverwaltung.
            </p>
          </div>
        )}

        {/* ----- FORM ----- */}
        {step === 'form' && (
          <form
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              // Enter in normalen Feldern soll das Formular NICHT abschicken
              // (nur der Button) — Textareas behalten den Zeilenumbruch.
              const el = e.target as HTMLElement;
              if (e.key === 'Enter' && el.tagName !== 'TEXTAREA') {
                e.preventDefault();
              }
            }}
            className="space-y-10"
          >
            <header>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Mangelmeldung</h1>
              <p className="mt-1 text-zinc-500">Technischen Defekt oder Schaden melden.</p>
            </header>

            {/* 1. Objekt */}
            <section>
              <SectionTitle n={1}>Betroffenes Objekt</SectionTitle>
              <div className="mb-3 flex items-center justify-between rounded-lg bg-zinc-100 px-3.5 py-2.5 text-sm">
                <span className="text-zinc-600">
                  Angemeldet mit <span className="font-medium text-zinc-900">Mieter-ID {odooId}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setStep('identify')}
                  className="font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                >
                  Ändern
                </button>
              </div>
              {tenancies.length > 0 ? (
                <Select value={selectedTenancyId} onChange={(e) => setSelectedTenancyId(e.target.value)} required>
                  <option value="">— Objekt wählen —</option>
                  {tenancies.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </Select>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-700">
                  Keine Objekte gefunden. Bitte fahren Sie fort – wir ordnen das Ticket manuell zu.
                </div>
              )}
            </section>

            {/* 2. Kontakt */}
            <section>
              <SectionTitle n={2}>Kontaktdaten</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Vor- und Nachname" />
                </Field>
                <Field label="Telefonnummer">
                  <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+49 …" />
                </Field>
                <Field label="E-Mail-Adresse" className="sm:col-span-2">
                  <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="name@firma.de" />
                </Field>
              </div>
            </section>

            {/* 3. Zugang */}
            <section>
              <SectionTitle n={3}>Verfügbarkeit & Zugang</SectionTitle>
              <p className="mb-3 text-sm text-zinc-600">Ist Zugang zur Mietfläche erforderlich?</p>
              <div className="flex gap-3">
                {[
                  { v: true, label: 'Ja' },
                  { v: false, label: 'Nein' },
                ].map(({ v, label }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setAccessRequired(v)}
                    className={cn(
                      'h-11 flex-1 rounded-lg border text-sm font-medium transition-all',
                      accessRequired === v
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {accessRequired === true && (
                <div className="mt-4 space-y-4 border-l-2 border-indigo-200 pl-4">
                  <Field label="Bevorzugtes Zeitfenster">
                    <Input value={accessTimeWindow} onChange={(e) => setAccessTimeWindow(e.target.value)} placeholder="z. B. Mo–Fr 09:00–18:00" />
                  </Field>
                  <Field label="Zugangsinformationen">
                    <Textarea value={accessInstructions} onChange={(e) => setAccessInstructions(e.target.value)} placeholder="Schlüsselübergabe, Ansprechpartner vor Ort …" className="min-h-[90px]" />
                  </Field>
                </div>
              )}
            </section>

            {/* 4. Beschreibung */}
            <section>
              <SectionTitle n={4}>Problembeschreibung</SectionTitle>
              <div className="space-y-4">
                <Field label="Titel / Kurzbezeichnung" required>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Heizung defekt" required />
                </Field>
                <Field label="Detaillierte Beschreibung" required>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Beschreiben Sie das Problem so genau wie möglich …" className="min-h-[140px]" required />
                </Field>
              </div>
            </section>

            {/* 5. Lage */}
            <section>
              <SectionTitle n={5}>Lage des Problems</SectionTitle>
              <div className="space-y-4">
                <Field label="Gebäudeteil / Bereich">
                  <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="z. B. Verkaufsraum, Lager, Büro" />
                </Field>
                <Field label="Genaue Position">
                  <Textarea value={detailedLocation} onChange={(e) => setDetailedLocation(e.target.value)} placeholder="z. B. neben dem Haupteingang, hinter der Kasse …" className="min-h-[80px]" />
                </Field>
              </div>
            </section>

            {/* 6. Kategorie */}
            <section>
              <SectionTitle n={6}>Kategorie</SectionTitle>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {MAIN_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      setMainCategory(cat.key);
                      setCategories([]);
                    }}
                    className={cn(
                      'rounded-xl border p-3 text-center transition-all',
                      mainCategory === cat.key ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-200 hover:border-zinc-300'
                    )}
                  >
                    <svg className={cn('mx-auto mb-2 h-6 w-6', mainCategory === cat.key ? 'text-indigo-600' : 'text-zinc-400')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                    </svg>
                    <span className={cn('text-xs font-medium', mainCategory === cat.key ? 'text-indigo-700' : 'text-zinc-600')}>{cat.label}</span>
                  </button>
                ))}
              </div>
              {mainCategory && SUBCATEGORY_OPTIONS[mainCategory] && (
                <div className="mt-4 space-y-1.5 border-l-2 border-indigo-200 pl-4">
                  {SUBCATEGORY_OPTIONS[mainCategory].map(([key, label]) => (
                    <label
                      key={key}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg p-2.5 transition-colors',
                        categories.includes(key) ? 'bg-indigo-50' : 'hover:bg-zinc-100'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={categories.includes(key)}
                        onChange={() => toggleCategory(key)}
                        className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className={cn('text-sm', categories.includes(key) ? 'font-medium text-indigo-700' : 'text-zinc-700')}>{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </section>

            {/* 7. Dringlichkeit */}
            <section>
              <SectionTitle n={7}>Dringlichkeit</SectionTitle>
              <div className="flex gap-3">
                {(['low', 'medium', 'high'] as Priority[]).map((p) => {
                  const labels = { low: 'Niedrig', medium: 'Normal', high: 'Hoch' };
                  const desc = { low: 'Kann warten', medium: 'Zeitnah beheben', high: 'Sofort handeln' };
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={cn(
                        'flex-1 rounded-xl border p-3 text-center transition-all',
                        priority === p ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-200 hover:border-zinc-300'
                      )}
                    >
                      <span className={cn('block text-sm font-semibold', priority === p ? 'text-indigo-700' : 'text-zinc-900')}>{labels[p]}</span>
                      <span className="mt-0.5 block text-xs text-zinc-400">{desc[p]}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 8. Anhänge */}
            <section>
              <SectionTitle n={8}>Fotos & Dokumente</SectionTitle>
              <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                <p className="mb-1 font-medium text-zinc-900">Tipp</p>
                Mindestens ein <strong>Gesamtfoto</strong> (Raum) und ein <strong>Detailfoto</strong> (Schaden). Falls vorhanden: Typenschild fotografieren.
              </div>
              <Field label="Beschreibung der Fotos" className="mb-4">
                <Textarea value={attachmentsDescription} onChange={(e) => setAttachmentsDescription(e.target.value)} placeholder="Was ist auf den Bildern zu sehen?" className="min-h-[70px]" />
              </Field>

              <div className="rounded-xl border-2 border-dashed border-zinc-200 p-6">
                <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                    </svg>
                    Foto aufnehmen
                    <input type="file" accept="image/*" capture="environment" onChange={handleFilesChange} className="hidden" />
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    Dateien auswählen
                    <input type="file" multiple onChange={handleFilesChange} className="hidden" />
                  </label>
                </div>
              </div>

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{files.length} Datei(en)</p>
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg bg-zinc-100 px-3.5 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <FilePreview file={file} />
                        <span className="truncate text-sm text-zinc-900">{file.name}</span>
                        <span className="flex-shrink-0 text-xs text-zinc-400">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        {file.type.startsWith('image/') && (
                          <button type="button" onClick={() => setEditingFileIndex(index)} className="rounded px-2 py-1 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50">
                            Markieren
                          </button>
                        )}
                        <button type="button" onClick={() => removeFile(index)} className="p-1 text-zinc-400 transition-colors hover:text-zinc-900">
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 9. Weitere Hinweise */}
            <section>
              <SectionTitle n={9}>Weitere Hinweise</SectionTitle>
              <Textarea value={extraContactInfo} onChange={(e) => setExtraContactInfo(e.target.value)} placeholder="Sonstige Anmerkungen …" className="min-h-[80px]" />
            </section>

            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
            )}

            <div className="sticky bottom-4">
              <Button type="submit" size="lg" loading={submitting} className="w-full shadow-lg shadow-zinc-900/10">
                {submitting ? 'Wird gesendet …' : 'Mangel melden'}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
