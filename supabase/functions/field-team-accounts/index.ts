import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { loginEmail, usernameDomain, usernameHint, usernamePattern } from '../_shared/team-login.ts';

const headers = {
 'Access-Control-Allow-Origin': '*',
 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
 'Access-Control-Allow-Methods': 'POST, OPTIONS',
 'Cache-Control': 'no-store',
};
const reply = (status: number, error?: string) => Response.json(error ? { error } : { ok: true }, { status, headers });
const authOptions = { persistSession: false, autoRefreshToken: false };
const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const unavailable = 'Upravljanje korisnicima trenutno nije dostupno. Pokušajte ponovo.';

Deno.serve(async request => {
 if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
 if (request.method !== 'POST') return reply(405, 'Metod nije podržan.');
 const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
 if (!token) return reply(401, 'Prijavite se ponovo.');

 try {
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: authOptions });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return reply(401, 'Prijavite se ponovo.');
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
   auth: authOptions, global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { error: accessError } = await caller.rpc('field_team_list_accounts').limit(1);
  if (accessError) return accessError.code === '42501'
   ? reply(403, 'Korisnicima upravlja samo administrator.') : reply(503, unavailable);

  const body = await request.json().catch(() => null);
  if (body?.action === 'create') {
   const identifier = typeof body.identifier === 'string' ? body.identifier.trim().toLowerCase() : '';
   const name = typeof body.name === 'string' ? body.name.trim() : '';
   const password = typeof body.password === 'string' ? body.password : '';
   if (!name || name.length > 100) return reply(400, 'Unesite ime i prezime do 100 znakova.');
   if (identifier.includes('@')) {
    if (identifier.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier)) return reply(400, 'Unesite ispravnu e-mail adresu.');
    if (identifier.endsWith(usernameDomain) && !usernamePattern.test(identifier.slice(0, -usernameDomain.length))) return reply(400, usernameHint);
   } else if (!usernamePattern.test(identifier)) return reply(400, usernameHint);
   if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
    return reply(400, 'Lozinka mora imati najmanje 8 znakova i najviše 72 bajta.');
   }

   const { error } = await admin.auth.admin.createUser({
    email: loginEmail(identifier), password, email_confirm: true,
    user_metadata: { full_name: name }, app_metadata: { field_team_created_by: user.id },
   });
   if (error?.code === 'email_exists' || error?.code === 'user_already_exists') return reply(409, 'Nalog sa ovim korisničkim imenom ili e-mailom već postoji.');
   if (error?.code === 'weak_password') return reply(400, 'Unesite jaču lozinku.');
   if (error?.code === 'email_address_invalid' || error?.code === 'validation_failed') return reply(400, 'Proverite podatke za prijavu.');
   return error ? reply(503, unavailable) : reply(201);
  }

  if (body?.action === 'delete' && typeof body.id === 'string' && uuid.test(body.id)) {
   const { error } = await admin.rpc('field_team_deactivate_account', { p_actor: user.id, p_target: body.id });
   if (error?.code === '42501') return reply(403, 'Korisnicima upravlja samo administrator.');
   if (error?.code === '22023') return reply(400, 'Ne možete obrisati svoj nalog.');
   if (error?.code === 'P0002') return reply(404, 'Nalog nije pronađen.');
   if (error) return reply(503, unavailable);
   const { error: deletionError } = await admin.auth.admin.deleteUser(body.id, true);
   if (deletionError && deletionError.code !== 'user_not_found') {
    return reply(503, 'Pristup nalogu je ukinut. Brisanje nije završeno. Pokušajte ponovo.');
   }
   return reply(200);
  }
  return reply(400, 'Zahtev nije ispravan.');
 } catch {
  return reply(503, unavailable);
 }
});
