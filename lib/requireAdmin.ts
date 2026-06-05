// lib/requireAdmin.ts
//
// Server-side admin guard for route handlers. The middleware does NOT cover
// /api routes, so any handler returning sensitive data must call this itself.
// Reads the caller's Supabase session from cookies and verifies role admin_am.

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from './supabaseAdmin';

export async function getAdminUser(): Promise<{ id: string; email: string | null } | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Read-only verification: token refresh is handled by the middleware
        // on page navigations, so we don't persist cookies here.
        set() {},
        remove() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin_am') return null;
  return { id: user.id, email: user.email ?? null };
}
