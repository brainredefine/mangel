// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Initialiser la réponse de base
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. Créer le client Supabase
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Met à jour les cookies sur la requête (pour le code serveur actuel)
          request.cookies.set({
            name,
            value,
            ...options,
          })
          // Met à jour les cookies sur la réponse (pour le navigateur)
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          // Astuce pour supprimer : définir une valeur vide et écraser
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // 3. Récupérer l'utilisateur
  // Note: getUser est plus sécurisé que getSession dans le middleware car il revalide le token
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // --- LOGIQUE DE PROTECTION ---

  // CAS A : L'utilisateur n'est PAS connecté
  // S'il essaie d'aller sur le dashboard (ou toute route protégée), on le renvoie au Login
  if (!user && path.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  // CAS B : L'utilisateur EST connecté
  if (user) {
    // 1. S'il essaie d'aller sur la page de Login/Activation (/auth) -> Dashboard
    // Attention : On utilise '===' pour ne cibler QUE la racine /auth
    if (path === '/auth' || path === '/sign-in') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    // 2. Note importante pour "Reset Password" :
    // Si l'utilisateur va sur `/auth/reset-password`, le path n'est pas strictement égal à `/auth`.
    // Donc il ne rentre pas dans le 'if' ci-dessus.
    // C'est exactement ce qu'on veut : l'utilisateur connecté DOIT pouvoir accéder à la page de reset.
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (si tu en as)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}