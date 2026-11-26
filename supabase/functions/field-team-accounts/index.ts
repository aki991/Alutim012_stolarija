import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { canChangeLoginIdentifier, loginEmail, usernameDomain, usernameHint, usernamePattern } from '../_shared/team-login.ts';

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
const accessDenied = 'Korisnicima upravlja šef ili admin.';

function identifierError(identifier: string) {
 if (identifier.includes('@')) {
  if (identifier.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier)) return 'Unesite ispravnu e-mail adresu.';
  if (identifier.endsWith(usernameDomain) && !usernamePattern.test(identifier.slice(0, -usernameDomain.length))) return usernameHint;
 } else if (!usernamePattern.test(identifier)) return usernameHint;
 return '';
}

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
   ? reply(403, accessDenied) : reply(503, unavailable);

  const body = await request.json().catch(() => null);
  if (body?.action === 'create' || body?.action === 'link') {
   const role = body.role === undefined ? 'worker' : body.role;
   if (role !== 'manager' && role !== 'worker' && role !== 'salon') return reply(400, 'Izaberite ulogu šefa, majstora ili salona.');
   const identifier = typeof body.identifier === 'string' ? body.identifier.trim().toLowerCase() : '';
   const invalidIdentifier = identifierError(identifier);
   if (invalidIdentifier) return reply(400, invalidIdentifier);
   const email = loginEmail(identifier);
   if (body.action === 'link') {
    const { error } = await admin.rpc('field_team_link_account', { p_actor: user.id, p_email: email, p_role: role });
    if (error?.code === '42501') return reply(403, accessDenied);
    if (error?.code === 'P0002') return reply(404, 'Postojeći nalog nije pronađen. Proverite korisničko ime ili e-mail.');
    if (error?.code === '22023') return reply(409, 'Pristup ovom nalogu je ukinut.');
    if (error?.code === 'P2001') return reply(409, 'Nalog već ima ulogu u Stolariji.');
    return error ? reply(503, unavailable) : reply(200);
   }
   const name = typeof body.name === 'string' ? body.name.trim() : '';
   const password = typeof body.password === 'string' ? body.password : '';
   if (!name || name.length > 100) return reply(400, 'Unesite ime i prezime do 100 znakova.');
   if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
    return reply(400, 'Lozinka mora imati najmanje 8 znakova i najviše 72 bajta.');
   }

   const { data: registration, error: prepareError } = await admin.rpc('field_team_prepare_account', {
    p_actor: user.id, p_email: email, p_role: role,
   });
   if (prepareError?.code === '42501') return reply(403, accessDenied);
   if (prepareError || !registration) return reply(503, unavailable);
   const { error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: name }, app_metadata: { field_team_registration: registration },
   });
   if (error?.code === 'email_exists' || error?.code === 'user_already_exists') return reply(409, 'Nalog već postoji. Izaberite Postojeći nalog da mu dodelite pristup Stolariji.');
   if (error?.code === 'weak_password') return reply(400, 'Unesite jaču lozinku.');
   if (error?.code === 'email_address_invalid' || error?.code === 'validation_failed') return reply(400, 'Proverite podatke za prijavu.');
   return error ? reply(503, unavailable) : reply(201);
  }

  if (body?.action === 'update' && typeof body.id === 'string' && uuid.test(body.id)) {
   const name = typeof body.name === 'string' ? body.name.trim() : '';
   if (!name || name.length > 100) return reply(400, 'Unesite ime i prezime do 100 znakova.');
   if ('password' in body || 'role' in body) return reply(400, 'Zahtev za izmenu profila nije ispravan.');
   if (body.identifier !== undefined && typeof body.identifier !== 'string') return reply(400, 'Zahtev za izmenu profila nije ispravan.');

   const { data: permission, error: permissionError } = await admin.rpc('field_team_authorize_profile_edit', {
    p_actor: user.id, p_target: body.id,
   }).single<{ is_admin: boolean; email: string | null }>();
   if (permissionError?.code === '42501') return reply(403, accessDenied);
   if (permissionError?.code === 'P0002') return reply(404, 'Nalog nije pronađen.');
   if (permissionError || !permission) return reply(503, unavailable);

   let email: string | undefined;
   if (body.identifier !== undefined) {
    const identifier = body.identifier.trim().toLowerCase();
    if (loginEmail(identifier) !== permission.email) {
     const invalidIdentifier = identifierError(identifier);
     if (invalidIdentifier) return reply(400, invalidIdentifier);
     email = loginEmail(identifier);
     if (!canChangeLoginIdentifier(permission.is_admin, permission.email, email)) {
      return reply(403, 'Stvarnu e-mail adresu za prijavu može da promeni samo admin.');
     }
    }
   }
   const { error } = await admin.auth.admin.updateUserById(body.id, {
    ...(email ? { email, email_confirm: true } : {}),
    user_metadata: { full_name: name },
    app_metadata: { field_team_profile_edit: { actor_id: user.id, name, previous_email: email ? permission.email : null, email: email ?? null } },
   });
   if (error?.code === 'email_exists' || error?.code === 'user_already_exists' || error?.code === 'identity_already_exists') {
    return reply(409, 'Korisničko ime ili e-mail već se koristi.');
   }
   if (error?.code === 'user_not_found') return reply(404, 'Nalog nije pronađen.');
   return error ? reply(503, unavailable) : reply(200);
  }

  if (body?.action === 'delete' && typeof body.id === 'string' && uuid.test(body.id)) {
   const { error } = await admin.rpc('field_team_deactivate_account', { p_actor: user.id, p_target: body.id });
   if (error?.code === '42501') return reply(403, accessDenied);
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
