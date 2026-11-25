import { test, expect } from '@playwright/test';
import type { Job } from '../src/models';
import type { TeamJob, TeamMember } from '../src/services/team-api';

test('Poslovi prikazuju lokalno merenje posle prijave i prenose ga na zahtev', async ({ page, context }) => {
 const member: TeamMember = { id: '10000000-0000-4000-8000-000000000001', name: 'Miloš', role: 'worker', active: true };
 const customer = 'Merenje kod kupca';
 const jobs = new Map<string, TeamJob>();
 let passwordSignIns = 0;
 let creates = 0;
 let statusChanges = 0;
 let failStatusChange = true;
 let holdProfile: Promise<void> | undefined;
 const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
 await page.setViewportSize({ width: 390, height: 844 });
 await page.route('https://team-tests.invalid/**', async route => {
  const request = route.request();
  const endpoint = new URL(request.url()).pathname.split('/').at(-1);
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const reply = (json: unknown) => route.fulfill({ headers, json });
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  switch (endpoint) {
   case 'token': {
    passwordSignIns++;
    expect(request.postDataJSON()).toMatchObject({ email: 'milos@alutim012.local', password: 'test-password' });
    const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: member.id, exp: Date.now() / 1000 + 3600 })}.signature`;
    return reply({ access_token: token, refresh_token: 'test-refresh', expires_in: 3600,
     user: { id: member.id, email: 'milos@alutim012.local', aud: 'authenticated' } });
   }
   case 'field_team_my_profile':
    await holdProfile;
    return reply(request.headers().accept?.includes('vnd.pgrst.object') ? member : [member]);
   case 'field_team_pricing': return reply({ prices: {}, porta_royal_prices: {}, vat: 20, vat_mode: 'exclusive', revision: 0 });
   case 'field_team_visible_jobs': return reply([...jobs.values()]);
   case 'field_team_create_job': {
    creates++;
    const data: Job = request.postDataJSON().p_job;
    expect(data.customer.name).toBe(customer);
    expect(data.technician).toBe(member.name);
    expect(data.positions[0]).toMatchObject({ width: 1680, extraCost: 0 });
    expect(data.positions[0].photos).toEqual([expect.stringMatching(/^data:image\/jpeg;base64,/)]);
    const existing = jobs.get(data.id);
    if (existing) return reply(existing);
    const row: TeamJob = { id: data.id, data: { ...data, status: 'Merenje' }, assigned_to: member.id,
     assigned_by: null, revision: 1, assignee_only: true };
    jobs.set(row.id, row);
    return reply(row);
   }
   case 'field_team_update_job': {
    const { p_id, p_patch, p_expected } = request.postDataJSON();
    expect(p_expected).toEqual({ status: 'Merenje' });
    expect(p_patch).toEqual({ status: 'Poslati ponudu' });
    if (failStatusChange) return route.fulfill({ headers, status: 503, json: { message: 'Prekinuta veza' } });
    const row = jobs.get(p_id)!;
    row.data = { ...row.data, ...p_patch };
    row.revision++;
    statusChanges++;
    return reply(row);
   }
   default: return reply([]);
  }
 });

 await page.goto('/prijava');
 await page.getByRole('button', { name: 'Radi bez interneta' }).click();
 await page.getByRole('button', { name: 'Novi posao' }).first().click();
 await page.getByRole('dialog').getByRole('textbox').fill(customer);
 await page.getByRole('button', { name: 'Započni merenje' }).click();
 await page.getByRole('link', { name: 'Prozor', exact: true }).click();
 await page.getByLabel('Širina (mm)').fill('1680');
 await page.getByRole('button', { name: 'Dodatne opcije' }).click();
 const options = page.getByRole('dialog', { name: 'Dodatne opcije' });
 await options.locator('summary').filter({ hasText: 'Montaža' }).click();
 await options.getByLabel('Dodatni radovi po komadu (€)').fill('50');
 await options.locator('summary').filter({ hasText: 'Fotografije' }).click();
 await options.locator('input[type=file]').setInputFiles('public/assets/house.jpg');
 await expect(options.getByRole('img', { name: 'Fotografija objekta 1' })).toBeVisible();
 await options.getByRole('button', { name: 'Gotovo' }).click();
 await page.getByRole('button', { name: 'Dodaj u posao' }).click();
 await expect(page.getByRole('heading', { name: 'Posao: ' + customer })).toBeVisible();
 await page.getByLabel('Rok završetka',{exact:true}).fill('2099-12-20');
 const jobUrl = page.url();
 const transfer = page.getByRole('button', { name: 'Dodaj u bazu' });
 await expect(page.getByRole('combobox', { name: 'Status posla: ' + customer })).toHaveValue('Merenje');

 await context.setOffline(true);
 await transfer.click();
 await expect(page.getByRole('alert')).toContainText('Povežite se na internet');
 expect(creates).toBe(0);
 await context.setOffline(false);
 await expect(page.getByText('Sačuvano lokalno')).toBeVisible();
 await page.evaluate(() => {
  for (const value of ['hidden', 'visible']) {
   Object.defineProperty(document, 'visibilityState', { configurable: true, value });
   document.dispatchEvent(new Event('visibilitychange'));
  }
  Reflect.deleteProperty(document, 'visibilityState');
 });
 await expect(page.getByRole('heading', { name: 'Prijava', exact: true })).toBeVisible();
 await page.getByLabel('E-mail ili korisničko ime').fill('milos');
 await page.getByLabel('Lozinka', { exact: true }).fill('test-password');
 await page.getByRole('button', { name: 'Prijavi se' }).click();
 const showJobs = () => page.getByRole('navigation', { name: 'Donja navigacija' }).getByRole('link', { name: 'Poslovi' }).click();
 await expect(page).toHaveURL(/\/poslovi$/);
 const localCard = page.getByRole('article').filter({ has: page.getByText('Na telefonu', { exact: true }) });
 await expect(localCard).toContainText(customer);
 await expect(page.getByRole('heading', { name: 'Porodica Petrović' })).toHaveCount(0);
 expect(creates).toBe(0);
 await localCard.getByRole('button', { name: 'Dodaj u bazu' }).click();

 await expect(page.getByRole('alert')).toContainText('Prenos nije potvrđen');
 expect(jobs.size).toBe(1);
 await page.getByRole('link', { name: 'Vrati se na poslove' }).click();
 await page.reload();
 await expect(localCard).toContainText(customer);
 await expect(page.getByRole('heading', { name: customer, exact: true })).toHaveCount(1);
 failStatusChange = false;
 await localCard.getByRole('button', { name: 'Dodaj u bazu' }).click();
 await expect(page.getByText('Posao je prebačen u tim.')).toBeVisible();
 await expect(page).toHaveURL(jobUrl);
 expect(creates).toBe(2);
 expect(jobs.size).toBe(1);
 expect(statusChanges).toBe(1);
 expect([...jobs.values()][0].data.status).toBe('Poslati ponudu');
 await showJobs();
 await expect(localCard).toHaveCount(0);
 await expect(page.getByRole('heading', { name: customer, exact: true })).toHaveCount(1);

 await page.goto('/nalog');
 const offlineWork = page.getByRole('button', { name: 'Radi bez interneta' });
 await expect(page.getByRole('button', { name: 'Odjavi se' })).toBeVisible();
 await expect(offlineWork).toHaveCount(0);

 let releaseProfile = () => {};
 holdProfile = new Promise<void>(resolve => { releaseProfile = resolve; });
 try {
  await page.reload();
  await expect(page.getByRole('status')).toHaveText('Učitavanje aplikacije…');
  await expect(page.getByLabel('E-mail ili korisničko ime')).toHaveCount(0);
  await expect(offlineWork).toHaveCount(0);
  await context.setOffline(true);
  await expect(page.getByRole('heading', { name: 'Nema internet veze' })).toBeVisible();
  await offlineWork.click();
  await expect(page.getByRole('heading', { name: 'Svi poslovi' })).toBeVisible();
 } finally {
  await context.setOffline(false);
  releaseProfile();
  holdProfile = undefined;
 }
 const localJob = page.getByRole('heading', { name: customer, exact: true });
 await page.getByRole('link').filter({ has: localJob }).click();
 await expect(page.getByText('Sačuvano lokalno')).toBeVisible();
 await page.goto('/');
 await expect(page).toHaveURL(/\/poslovi$/);
 await expect(page.getByLabel('Lozinka', { exact: true })).toHaveCount(0);
 await page.getByRole('link').filter({ has: localJob }).click();
 await expect(page.getByText('Sačuvano u bazi')).toBeVisible();
 expect(passwordSignIns).toBe(1);
 expect(creates).toBe(2);
});
