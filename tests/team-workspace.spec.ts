import { test, expect, type Page } from '@playwright/test';
import type { TeamJob, TeamMember, TeamMessage, TeamNotification } from '../src/services/team-api';
import type { Job } from '../src/models';

test('Šef dodeljuje merenje, a majstor vraća mere, poruku i statuse', async ({ browser, page }) => {
 test.setTimeout(60000);
 const boss = { id: '10000000-0000-4000-8000-000000000001', name: 'Šef', role: 'manager', active: true } as const;
 const worker = { id: '10000000-0000-4000-8000-000000000002', name: 'Miloš', role: 'worker', active: true } as const;
 const people = [boss, worker];
 const jobs = new Map<string, TeamJob>();
 const inbox = new Map<string, TeamNotification[]>();
 const messages: TeamMessage[] = [];
 const now = () => new Date().toISOString();

 function notify(recipient: TeamMember, actor: TeamMember, row: TeamJob, kind: TeamNotification['kind'], body: string) {
  inbox.set(recipient.id, [{ id: crypto.randomUUID(), job_id: row.id, kind, actor_name: actor.name, job_name: row.data.customer.name, body, read_at: null, created_at: now() }, ...(inbox.get(recipient.id) ?? [])]);
 }

 // Supabase responses are intercepted. The browser still uses the real Auth and REST clients.
 async function mockSupabase(target: Page, member: TeamMember) {
  await target.route(/\/(auth|rest)\/v1\//, async route => {
   const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.split('/').pop();
   const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
   const reply = (json: unknown) => route.fulfill({ headers, json });
   const replyRow = (row: TeamJob) => reply(request.headers().accept?.includes('vnd.pgrst.object') ? row : [row]);
   if (request.method() === 'OPTIONS') return route.fulfill({ headers, status: 204 });
   if (endpoint === 'token') {
    const { email, password } = request.postDataJSON();
    expect(email).toBe(member.role === 'manager' ? 'manager@example.test' : 'milos@alutim012.local');
    if (password !== 'test-password') return route.fulfill({ status: 400, headers, json: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: member.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
    return reply({ access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user: { id: member.id, email, aud: 'authenticated' } });
   }
   if (endpoint === 'logout') return route.fulfill({ headers, status: 204 });
   const body = request.postDataJSON() ?? {};
   const visible = [...jobs.values()].filter(row => member.role === 'manager' || row.assigned_to === member.id);
   switch (endpoint) {
    case 'field_team_members': return reply(url.searchParams.has('id') ? [member] : people.filter(person => person.role === 'worker'));
    case 'field_team_visible_jobs': return reply(visible.map(row => member.role === 'manager' && row.assigned_to && row.data.status === 'Merenje'
     ? { ...row, data: { ...row.data, positions: [] } } : row));
    case 'field_team_messages': return reply(messages.filter(message => `eq.${message.job_id}` === url.searchParams.get('job_id')).reverse());
    case 'field_team_notifications': return reply(inbox.get(member.id) ?? []);
    case 'field_team_create_job': {
     const data: Job = body.p_job;
     expect(body.p_assignee).toBe(worker.id);
     expect(data.status).toBe('Merenje');
     expect(data.customer).toMatchObject({ name: 'Porodica Test', address: 'Glavna 12', phone: '064111222' });
     const row = { id: data.id, data, assigned_to: body.p_assignee, assigned_by: member.id, revision: 1 };
     jobs.set(row.id, row);
     messages.push({ id: crypto.randomUUID(), job_id: row.id, sender_id: member.id, sender_name: member.name, body: body.p_message, created_at: now() });
     notify(worker, member, row, 'assignment', body.p_message);
     return replyRow(row);
    }
    case 'field_team_update_job': {
     const row = jobs.get(body.p_id)!;
     row.data = { ...row.data, ...body.p_patch, updated: now() };
     row.revision++;
     if (body.p_patch.status) notify(member.role === 'worker' ? boss : worker, member, row, 'status', body.p_patch.status);
     return replyRow(member.role === 'manager' && row.assigned_to && row.data.status === 'Merenje'
      ? { ...row, data: { ...row.data, positions: [] } } : row);
    }
    case 'field_team_send_message': {
     const row = jobs.get(body.p_id)!;
     messages.push({ id: body.p_message_id, job_id: row.id, sender_id: member.id, sender_name: member.name, body: body.p_body, created_at: now() });
     notify(boss, member, row, 'message', body.p_body);
     return reply(null);
    }
    case 'field_team_read_notification': {
     const notification = inbox.get(member.id)?.find(item => item.id === body.p_id);
     if (notification) notification.read_at = now();
     return reply(null);
    }
    default: return route.abort();
   }
  });
 }

 async function login(target: Page, member: TeamMember) {
  await mockSupabase(target, member);
  await target.goto('/tim');
  await expect(target).toHaveURL(/\/prijava$/);
  await expect(target.getByRole('heading', { name: 'Prijava', exact: true })).toBeVisible();
  await expect(target.getByRole('button', { name: 'Nastavi bez interneta (gost)' })).toHaveCount(0);
  const identifier = target.getByLabel('E-mail ili korisničko ime');
  const password = target.getByLabel('Lozinka', { exact: true });
  await identifier.fill(member.role === 'manager' ? ' Manager@Example.test ' : ' MiLoS ');
  if (member.role === 'manager') {
   await password.fill('wrong-password');
   await target.getByRole('button', { name: 'Prijavi se' }).click();
   await expect(target.getByRole('alert')).toContainText('Proverite e-mail ili korisničko ime i lozinku');
   await expect(password).toHaveValue('');
  }
  await password.fill('test-password');
  await target.getByRole('button', { name: 'Prikaži lozinku' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await target.getByRole('button', { name: 'Sakrij lozinku' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await target.getByRole('button', { name: 'Prijavi se' }).click();
  await expect(target.getByRole('heading', { name: 'Tim i obaveštenja' })).toBeVisible();
 }

 await login(page, boss);
 await page.getByRole('combobox', { name: 'Majstor', exact: true }).selectOption({ label: 'Miloš' });
 await page.getByLabel('Naziv firme ili ime kupca').fill('Porodica Test');
 await page.getByLabel('Adresa merenja').fill('Glavna 12');
 await page.getByLabel('Telefon').fill('064111222');
 await page.getByLabel('Poruka majstoru').fill('Izmeri prozore u prizemlju.');
 await page.getByRole('button', { name: 'Dodeli i pošalji' }).click();
 await expect(page.getByRole('heading', { name: 'Posao: Porodica Test' })).toBeVisible();
 const jobUrl = page.url();
 const statusName = 'Status posla: Porodica Test';
 const bossStatus = page.getByRole('combobox', { name: statusName });

 const workerContext = await browser.newContext({ baseURL: page.url(), viewport: { width: 390, height: 844 } });
 try {
  const mobile = await workerContext.newPage();
  await login(mobile, worker);
  await expect(mobile.getByRole('heading', { name: 'Dodeli merenje' })).toHaveCount(0);
  await mobile.getByRole('link', { name: /Dodeljeno merenje.*Porodica Test/ }).click();
  await expect(mobile.getByText('Glavna 12')).toBeVisible();
  await expect(mobile.getByText('Izmeri prozore u prizemlju.')).toBeVisible();
  await mobile.getByRole('link', { name: 'Dodaj element' }).first().click();
  await mobile.getByRole('link', { name: 'Prozor', exact: true }).click();
  await mobile.getByRole('button', { name: 'Dodaj u posao' }).click();
  await expect(mobile.getByRole('region', { name: 'Elementi posla' })).toBeVisible();
  await expect.poll(() => [...jobs.values()][0].data.positions.length).toBe(1);
  await page.goto(`${jobUrl}/ponuda`);
  await expect(page).toHaveURL(jobUrl);
  await expect(page.getByRole('heading', { name: 'Merenje je u toku' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Elementi posla' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Dodaj element' })).toHaveCount(0);
  await expect(bossStatus).toBeDisabled();
  await expect(mobile.getByRole('combobox', { name: statusName })).toBeDisabled();
  await mobile.getByRole('button', { name: 'Merenje završeno' }).click();
  await expect(mobile.getByRole('combobox', { name: statusName })).toHaveValue('Poslati ponudu');
  await expect(bossStatus).toHaveValue('Poslati ponudu', { timeout: 10000 });
  await expect(page.getByRole('region', { name: 'Elementi posla' })).toBeVisible();

  await bossStatus.selectOption('Merenje');
  await expect(page.getByRole('heading', { name: 'Merenje je u toku' })).toBeVisible();
  await expect(mobile.getByRole('button', { name: 'Merenje završeno' })).toBeEnabled({ timeout: 10000 });
  await mobile.getByRole('link', { name: 'Izmeni element 1' }).click();
  await mobile.getByLabel('Širina (mm)').fill('1700');
  await mobile.getByRole('button', { name: 'Sačuvaj izmene' }).click();
  await expect(mobile.getByText(/1700 ×/)).toBeVisible();
  await expect(page.getByText(/1700 ×/)).toHaveCount(0);
  await mobile.getByRole('button', { name: 'Merenje završeno' }).click();
  await expect(page.getByText(/1700 ×/)).toBeVisible({ timeout: 10000 });

  await mobile.getByLabel('Poruka šefu').fill('Svi prozori izmereni.');
  await mobile.getByRole('button', { name: 'Pošalji poruku' }).click();
  await expect(mobile.getByText('Svi prozori izmereni.')).toBeVisible();
  await bossStatus.selectOption('Ponuda');
  const workerStatus = mobile.getByRole('combobox', { name: statusName });
  await expect(workerStatus).toHaveValue('Ponuda', { timeout: 10000 });
  await workerStatus.selectOption('Prihvaćeno');

  await page.goto('/tim');
  await expect(page.getByRole('link', { name: /Promena statusa.*Poslati ponudu/ })).toHaveCount(2);
  await expect(page.getByRole('link', { name: /Promena statusa.*Prihvaćeno/ })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('link', { name: /Poruka.*Svi prozori izmereni/ })).toBeVisible();
  await page.getByRole('link', { name: /Promena statusa.*Prihvaćeno/ }).click();
  await expect(bossStatus).toHaveValue('Prihvaćeno');
  await expect(page.getByRole('region', { name: 'Elementi posla' })).toBeVisible();
  await page.goto(`${jobUrl}/ponuda`);
  await page.getByRole('button', { name: 'Ponuda za kupca', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Pregled: Ponuda za kupca' }).getByRole('button', { name: 'Preuzmi PDF' })).toBeVisible();
  await page.goto(jobUrl);
  await bossStatus.selectOption('U izradi');
  await expect(workerStatus).toHaveValue('U izradi', { timeout: 10000 });
  await bossStatus.selectOption('Završeno');
  await expect(workerStatus).toHaveValue('Završeno', { timeout: 10000 });
  await mobile.goto('/tim');
  await expect(mobile.getByRole('link', { name: /Promena statusa.*U izradi/ })).toBeVisible();
  await expect(mobile.getByRole('link', { name: /Promena statusa.*Završeno/ })).toBeVisible();
  await mobile.getByRole('button', { name: 'Odjavi se' }).click();
  await expect(mobile.getByRole('heading', { name: 'Prijava', exact: true })).toBeVisible();
  await workerContext.setOffline(true);
  await mobile.getByRole('button', { name: 'Nastavi bez interneta (gost)' }).click();
  await expect(mobile.getByRole('heading', { name: 'Brza ponuda na terenu' })).toBeVisible();
 } finally { await workerContext.close(); }
});
