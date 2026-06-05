// /app/tickets/new/page.tsx — choose ticket type (public, no account).

import Link from 'next/link';

export default function NewTicketSelectPage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Startseite
          </Link>
          <Link href="/tickets/track" className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900">
            Ticket verfolgen
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Neues Ticket erstellen</h1>
          <p className="mt-2 text-zinc-500">Wählen Sie die Art Ihrer Anfrage.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Mangelmeldung */}
          <Link
            href="/tickets/new/defect"
            className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">Mangelmeldung</h2>
            <p className="mt-1.5 text-sm text-zinc-500">
              Technischer Defekt, Schaden oder Reparaturbedarf in Ihrer Mietfläche.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-zinc-500">
              {['Beleuchtung & Elektrik', 'Heizung, Klima & Sanitär', 'Türen, Fenster & Boden'].map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-indigo-500" />
                  {x}
                </li>
              ))}
            </ul>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition-all group-hover:gap-2.5">
              Mangel melden
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          </Link>

          {/* Allgemeine Anfrage */}
          <Link
            href="/tickets/new/request"
            className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">Allgemeine Anfrage</h2>
            <p className="mt-1.5 text-sm text-zinc-500">
              Dokumente anfordern, Fragen stellen oder sonstige Anliegen mitteilen.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-zinc-500">
              {['Dokumente anfordern', 'Bescheinigungen', 'Allgemeine Fragen'].map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-zinc-400" />
                  {x}
                </li>
              ))}
            </ul>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 transition-all group-hover:gap-2.5">
              Anfrage stellen
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
