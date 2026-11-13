import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import webpush from 'npm:web-push@3.6.7';
import { timingSafeEqual } from 'node:crypto';

type Delivery = {
 delivery_id: string; lease: number; device_id: string; endpoint: string;
 p256dh: string; auth_secret: string; kind: 'message' | 'assignment' | 'status'; job_id: string;
};

const encoder = new TextEncoder();
const expectedToken = encoder.encode(Deno.env.get('FIELD_PUSH_DISPATCH_TOKEN') ?? '');
const vapidDetails = {
 subject: 'https://alutim012stolarija.vercel.app',
 publicKey: Deno.env.get('FIELD_PUSH_PUBLIC_KEY') ?? '',
 privateKey: Deno.env.get('FIELD_PUSH_PRIVATE_KEY') ?? '',
};

Deno.serve(async request => {
 if (request.method !== 'POST') return new Response(null, { status: 405 });
 const token = encoder.encode(request.headers.get('X-Team-Push-Token') ?? '');
 if (!expectedToken.length || token.length !== expectedToken.length || !timingSafeEqual(token, expectedToken)) {
  return new Response(null, { status: 401 });
 }

 const api = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
 });
 const { data, error } = await api.rpc('field_team_push_claim');
 if (error) {
  console.error('Could not claim push deliveries', error.code);
  return new Response(null, { status: 503 });
 }
 const results = await Promise.all((data as Delivery[]).map(async delivery => {
  const message = delivery.kind === 'message';
  const payload = JSON.stringify({
   title: message ? 'Nova poruka' : delivery.kind === 'assignment' ? 'Dodeljeno merenje' : 'Novi status posla',
   body: message ? 'Otvorite razgovor u aplikaciji ALU TIM 012.' : 'Pogledajte obaveštenje u aplikaciji ALU TIM 012.',
   path: message ? `/poruke/${encodeURIComponent(delivery.job_id)}` : '/obavestenja',
   tag: delivery.delivery_id,
  });
  let result = 'done';
  try {
   const push = webpush.generateRequestDetails({ endpoint: delivery.endpoint, keys: { p256dh: delivery.p256dh, auth: delivery.auth_secret } },
    payload, { vapidDetails, TTL: 3600, urgency: 'high' });
   const response = await fetch(push.endpoint, {
    method: push.method, headers: push.headers, body: push.body ? new Uint8Array(push.body) : undefined,
    redirect: 'error', signal: AbortSignal.timeout(9000),
   });
   if (response.status === 404 || response.status === 410) result = 'expired';
   else if (response.status === 400 || response.status === 413) {
    console.warn('Push service rejected a delivery', response.status);
   } else if (!response.ok) {
    console.warn('Push service temporarily unavailable', response.status);
    return false;
   }
   await response.body?.cancel();
  } catch {
   console.warn('Push delivery failed; scheduled retry will run');
   return false;
  }
  const { error: finishError } = await api.rpc('field_team_push_finish', {
   p_id: delivery.delivery_id, p_lease: delivery.lease, p_result: result,
  });
  if (finishError) console.error('Could not finish push delivery', finishError.code);
  return !finishError;
 }));
 return Response.json({ handled: results.filter(Boolean).length, retrying: results.filter(ok => !ok).length });
});
