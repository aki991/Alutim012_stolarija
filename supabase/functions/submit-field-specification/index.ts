import { createClient } from '@supabase/supabase-js';
import { createSubmissionHandler } from '../_shared/field-submission.ts';

const url = Deno.env.get('SUPABASE_URL');
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

Deno.serve(createSubmissionHandler({
 getAdmin: () => {
  if (!url || !secret) throw new Error('Missing server configuration');
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
 },
 rateSalt: secret ?? '',
}));
