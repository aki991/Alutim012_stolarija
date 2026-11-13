import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | undefined;

// Both office submissions and employee sessions use the same configured project.
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase nije podešen. Unesite VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY u .env.local ili Vercel Environment Variables.',
    );
  }

  client ??= createClient(url, anonKey);
  return client;
}
