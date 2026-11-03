import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | undefined;

// Lazy initialization keeps the existing local application usable without a key.
// This client does not migrate or synchronize local jobs automatically.
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase nije podešen. Unesite VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY u .env.local ili Vercel Environment Variables.',
    );
  }

  client ??= createClient(url, anonKey);
  return client;
}
