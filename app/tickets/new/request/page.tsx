// /app/tickets/new/request/page.tsx — public Allgemeine Anfrage (no account).

'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import Link from 'next/link';
import {
  identifyTenantAction,
  createTicketAction,
  type TenancyOption,
} from '../actions';
import { Button, Card, Input, Textarea, Select, Field, cn } from '../../../../components/ui';

const REQUEST_CATEGORIES = [
  { key: 'DOCUMENT', label: 'Dokument anfordern', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' },
  { key: 'CERTIFICATE', label: 'Bescheinigung', icon: 'M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z' },
  { key: 'QUESTION', label: 'Allgemeine Frage', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z' },
  { key: 'OTHER', label: 'Sonstiges', icon: 'M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z' },
] as const;

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 text-sm font-semibold text-zinc-900">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-xs text-white">{n}</span>
      {children}
    </h2>
  );
}

export default function NewRequestPage() {
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

  // Request
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!selectedTenancyId) {
      setSubmitError('Bitte wählen Sie das betroffene Objekt aus.');
      return;
    }
    if (!category) {
      setSubmitError('Bitte wählen Sie die Art der Anfrage.');
      return;
    }
    if (!subject.trim()) {
      setSubmitError('Bitte geben Sie einen Betreff ein.');
      return;
    }
    if (!message.trim()) {
      setSubmitError('Bitte beschreiben Sie Ihr Anliegen.');
      return;
    }
    setSubmitting(true);

    const selTen = tenancies.find((t) => String(t.id) === selectedTenancyId);
    const fd = new FormData();
    fd.set('ticket_type', 'request');
    fd.set('odoo_tenancy_id', selectedTenancyId || '');
    fd.set('plz', plz);
    fd.set('asset_id', selTen?.asset_id != null ? String(selTen.asset_id) : '');
    fd.set('title', subject);
    fd.set('description', message);
    fd.set('priority', 'medium');
    fd.set('categories', JSON.stringify(category ? [category] : []));
    fd.set('contact_name', contactName);
    fd.set('contact_email', contactEmail);
    fd.set('contact_phone', contactPhone);
    for (const f of files) fd.append('files', f);

    const res = await createTicketAction(fd);
    if (res.success) {
      setTrackingCode(res.trackingCode);
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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Anfrage erfolgreich gesendet</h1>
          <p className="mt-2 text-zinc-500">
            Bewahren Sie diesen Tracking-Code auf, um den Status Ihrer Anfrage zu verfolgen.
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
              <Button className="w-full">Anfrage verfolgen</Button>
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
      {/* Top bar */}
      <header className="border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-6">
          <Link href="/tickets/new" className="flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Zurück
          </Link>
          <span className="text-sm text-zinc-400">Allgemeine Anfrage</span>
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
          <form onSubmit={handleSubmit} className="space-y-10">
            <header>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Allgemeine Anfrage</h1>
              <p className="mt-1 text-zinc-500">Dokumente anfordern, Fragen stellen oder sonstige Anliegen.</p>
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
                  {tenancies.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </Select>
              ) : (
                <p className="text-sm text-zinc-400">Keine Objekte gefunden.</p>
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

            {/* 3. Art der Anfrage */}
            <section>
              <SectionTitle n={3}>Art der Anfrage</SectionTitle>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {REQUEST_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategory(cat.key)}
                    className={cn(
                      'rounded-xl border p-3 text-center transition-all',
                      category === cat.key ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-200 hover:border-zinc-300'
                    )}
                  >
                    <svg className={cn('mx-auto mb-2 h-6 w-6', category === cat.key ? 'text-indigo-600' : 'text-zinc-400')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                    </svg>
                    <span className={cn('text-xs font-medium', category === cat.key ? 'text-indigo-700' : 'text-zinc-600')}>{cat.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* 4. Betreff & Nachricht */}
            <section>
              <SectionTitle n={4}>Ihr Anliegen</SectionTitle>
              <div className="space-y-4">
                <Field label="Betreff" required>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Kurze Beschreibung Ihrer Anfrage" required />
                </Field>
                <Field label="Nachricht" required>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Beschreiben Sie Ihr Anliegen so detailliert wie möglich …" className="min-h-[160px]" required />
                </Field>
              </div>
            </section>

            {/* 5. Anhänge */}
            <section>
              <SectionTitle n={5}>Anhänge</SectionTitle>
              <div className="rounded-xl border-2 border-dashed border-zinc-200 p-6">
                <div className="flex flex-col items-center justify-center gap-3">
                  <svg className="h-9 w-9 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50">
                    Dateien auswählen
                    <input type="file" multiple onChange={handleFilesChange} className="hidden" />
                  </label>
                  <span className="text-xs text-zinc-400">Optional – z. B. Formulare oder Schriftverkehr</span>
                </div>
              </div>

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{files.length} Datei(en)</p>
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg bg-zinc-100 px-3.5 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <svg className="h-4 w-4 flex-shrink-0 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                        </svg>
                        <span className="truncate text-sm text-zinc-900">{file.name}</span>
                        <span className="flex-shrink-0 text-xs text-zinc-400">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                      </div>
                      <button type="button" onClick={() => removeFile(index)} className="p-1 text-zinc-400 transition-colors hover:text-zinc-900">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
            )}

            <div className="sticky bottom-4">
              <Button type="submit" size="lg" loading={submitting} className="w-full shadow-lg shadow-zinc-900/10">
                {submitting ? 'Wird gesendet …' : 'Anfrage absenden'}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
