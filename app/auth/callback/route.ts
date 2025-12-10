// app/auth/callback/route.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server' // <--- Import NextRequest

export async function GET(request: NextRequest) { // <--- Utiliser NextRequest ici
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value,
              ...options,
            })
          },
          // --- CORRECTION ICI ---
          remove(name: string, options: CookieOptions) {
            // Au lieu de .delete({ name, ... }), on utilise .set avec une valeur vide
            // Cela écrase le cookie avec une date d'expiration immédiate
            request.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
          // ----------------------
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Retour en cas d'erreur
  return NextResponse.redirect(`${origin}/auth`)
}