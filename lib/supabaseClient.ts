// lib/supabaseClient.ts
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// On utilise createBrowserClient au lieu de createClient
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);