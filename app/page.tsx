// /app/page.tsx — public landing for tenants (no account required).

import Link from 'next/link';

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
      </div>
      <span className="text-[15px] font-semibold tracking-tight text-zinc-900">Mangelmanagement</span>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Logo />
          <Link
            href="/auth"
            className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
          >
            Mitarbeiter-Login
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <section className="pt-16 pb-14 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Für Mieterinnen und Mieter
          </div>
          <h1 className="mx-auto max-w-2xl text-balance text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            Mängel schnell und einfach melden.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-lg text-zinc-500">
            Melden Sie einen Defekt oder stellen Sie eine Anfrage – ganz ohne Konto. Sie erhalten
            einen Tracking-Code, mit dem Sie den Status jederzeit verfolgen können.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/tickets/new"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 sm:w-auto"
            >
              Mangel melden
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/tickets/track"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-50 sm:w-auto"
            >
              Ticket verfolgen
            </Link>
          </div>
        </section>

        {/* Two paths */}
        <section className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/tickets/new"
            className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">Neues Ticket erstellen</h2>
            <p className="mt-1.5 text-sm text-zinc-500">
              Melden Sie einen technischen Defekt oder stellen Sie eine allgemeine Anfrage. Fotos
              helfen uns, schneller zu reagieren.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition-all group-hover:gap-2.5">
              Loslegen
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          </Link>

          <Link
            href="/tickets/track"
            className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">Ticket verfolgen</h2>
            <p className="mt-1.5 text-sm text-zinc-500">
              Geben Sie Ihren Tracking-Code ein und sehen Sie den aktuellen Bearbeitungsstand Ihres
              Anliegens.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 transition-all group-hover:gap-2.5">
              Status ansehen
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          </Link>
        </section>

        {/* How it works */}
        <section className="py-16">
          <h3 className="mb-8 text-center text-sm font-semibold uppercase tracking-wider text-zinc-400">
            So funktioniert&apos;s
          </h3>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { n: '1', t: 'Mieter-ID eingeben', d: 'Identifizieren Sie sich mit der ID, die Sie von uns erhalten haben.' },
              { n: '2', t: 'Mangel beschreiben', d: 'Beschreiben Sie das Problem und laden Sie Fotos hoch.' },
              { n: '3', t: 'Code erhalten', d: 'Sie bekommen einen Tracking-Code zur Statusverfolgung.' },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-sm font-semibold text-zinc-900 shadow-sm">
                  {s.n}
                </div>
                <h4 className="font-semibold text-zinc-900">{s.t}</h4>
                <p className="mx-auto mt-1.5 max-w-[14rem] text-sm text-zinc-500">{s.d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200/70">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-zinc-400 sm:flex-row">
          <span>© {new Date().getFullYear()} Redefine</span>
          <Link href="/auth" className="transition-colors hover:text-zinc-600">
            Mitarbeiter-Login
          </Link>
        </div>
      </footer>
    </div>
  );
}
