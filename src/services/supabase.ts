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

export async function changeOwnPassword(memberId: string, currentPassword: string, password: string) {
  const { auth } = getSupabase();
  const { data: { user }, error } = await auth.getUser();
  if (error || user?.id !== memberId || !user.email) throw new Error('Ponovo se prijavite da biste promenili lozinku.');

  // A fresh session verifies the current password even when that Auth setting
  // is disabled, and keeps the update tied to this user if another tab signs in.
  const { auth: verification } = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `alu-password-${crypto.randomUUID?.() ?? Date.now()}` },
  });
  const verified = await verification.signInWithPassword({ email: user.email, password: currentPassword });
  if (verified.error?.code === 'invalid_credentials' || (verified.error?.status === 400 && !verified.error.code)) {
    throw new Error('Trenutna lozinka nije ispravna.');
  }
  const session = verified.data.session;
  if (verified.error?.status === 429) throw new Error('Previše pokušaja. Sačekajte pa pokušajte ponovo.');
  if (verified.error || !session || session.user.id !== memberId) throw new Error('Provera lozinke trenutno nije dostupna.');

  const active = await auth.getSession();
  if (active.data.session?.user.id !== memberId) throw new Error('Ponovo se prijavite da biste promenili lozinku.');
  const resumed = await auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (resumed.error || resumed.data.user?.id !== memberId) throw new Error('Prijava trenutno nije dostupna. Pokušajte ponovo.');

  const updated = await verification.updateUser({ password, current_password: currentPassword });
  if (updated.error?.code === 'current_password_mismatch') throw new Error('Trenutna lozinka nije ispravna.');
  if (updated.error?.code === 'same_password') throw new Error('Nova lozinka mora da se razlikuje od trenutne.');
  if (updated.error?.code === 'weak_password') throw new Error('Unesite jaču lozinku.');
  if (updated.error) throw new Error('Promena lozinke trenutno nije uspela. Pokušajte ponovo.');
}
