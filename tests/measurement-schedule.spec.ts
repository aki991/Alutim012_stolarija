import { expect, test } from '@playwright/test';
import { makePosition } from '../src/catalog';
import type { Job } from '../src/models';
import type { TeamJob, TeamMember } from '../src/services/team-api';

test('Nezavršeno merenje prelazi u današnji raspored i čuva novi datum pri završetku', async ({ page }) => {
 const member: TeamMember = { id: '10000000-0000-4000-8000-000000000001', name: 'Miloš', role: 'worker', active: true };
 const manager = '20000000-0000-4000-8000-000000000001';
 const createRow = (id: string, name: string, date: string, status: Job['status'] = 'Merenje'): TeamJob => ({
  id, assigned_to: member.id, assigned_by: manager, revision: 1, assignee_only: false,
  data: {
   id, date, status, customer: { name, address: 'Glavna 12', phone: '', email: '', building: '' },
   technician: member.name, notes: '', positions: [makePosition()], package: 'Standard', discount: 0,
   transport: 0, extraWork: '', extraCost: 0, validity: '', delivery: '', payment: '', updated: '2026-11-17T10:00:00Z',
  },
 });
 const late = createRow('AT-2026-123', 'Merenje od 17. novembra', '2026-11-17');
 const future = createRow('AT-2026-124', 'Buduće merenje', '2026-11-20');
 const completed = createRow('AT-2026-125', 'Završeno merenje', '2026-11-16', 'Poslati ponudu');
 const rows = [late, future, completed];
 const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
 const authUser = { id: member.id, email: 'milos@alutim012.local', aud: 'authenticated' };
 await page.clock.install({ time: new Date('2026-11-17T22:59:00Z') });
 await page.route('https://team-tests.invalid/**', async route => {
  const request = route.request();
  const endpoint = new URL(request.url()).pathname.split('/').at(-1);
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const reply = (json: unknown) => route.fulfill({ headers, json });
  if (request.method() === 'OPTIONS') return route.fulfill({ headers, status: 204 });
  switch (endpoint) {
   case 'token': {
    const access = [encode({ alg: 'HS256', typ: 'JWT' }), encode({ sub: member.id, exp: 4102444800 }), 'signature'].join('.');
    return reply({ access_token: access, refresh_token: 'test-refresh', expires_in: 3600, user: authUser });
   }
   case 'field_team_my_profile': return reply(member);
   case 'field_team_pricing': return reply({ prices: {}, porta_royal_prices: {}, vat: 20, vat_mode: 'exclusive', revision: 0 });
   case 'field_team_visible_jobs': return reply(rows);
   case 'field_team_update_job': {
    const { p_id, p_patch, p_expected } = request.postDataJSON();
    expect(p_id).toBe(late.id);
    expect(p_expected).toEqual({ date: '2026-11-17', status: 'Merenje' });
    expect(p_patch).toEqual({ date: '2026-11-18', status: 'Poslati ponudu' });
    late.data = { ...late.data, ...p_patch };
    late.revision++;
    return reply(late);
   }
   default: return reply([]);
  }
 });

 await page.goto('/prijava');
 await page.getByLabel('E-mail ili korisničko ime').fill('milos');
 await page.getByLabel('Lozinka', { exact: true }).fill('test-password');
 await page.getByRole('button', { name: 'Prijavi se', exact: true }).click();
 await expect(page.getByRole('heading', { name: 'Obaveštenja', exact: true })).toBeVisible();
 await page.goto('/poslovi');
 const jobCard = (row: TeamJob) => page.locator('article').filter({ has: page.getByRole('heading', { name: row.data.customer.name, exact: true }) });
 await expect(jobCard(late).locator('time')).toHaveAttribute('datetime', '2026-11-17');
 await page.clock.fastForward(75_000);
 await expect(jobCard(late).locator('time')).toHaveAttribute('datetime', '2026-11-18');
 await expect(jobCard(future).locator('time')).toHaveAttribute('datetime', '2026-11-20');
 await expect(jobCard(completed).locator('time')).toHaveAttribute('datetime', '2026-11-16');

 await page.goto('/');
 await expect(page.getByRole('region', { name: 'Pregled rada' })).toContainText('1 merenje danas');
 await page.goto('/posao/' + late.id);
 await expect(page.getByText(/Merenje treba uraditi/).locator('time')).toHaveAttribute('datetime', '2026-11-18');
 await page.getByRole('button', { name: 'Podaci o kupcu' }).click();
 await page.getByText('Dodatni podaci', { exact: true }).click();
 await expect(page.getByLabel('Datum merenja')).toHaveValue('2026-11-18');
 await page.getByRole('button', { name: 'Otkaži', exact: true }).click();
 await page.getByRole('button', { name: 'Merenje završeno', exact: true }).click();
 await expect.poll(() => late.data).toMatchObject({ date: '2026-11-18', status: 'Poslati ponudu' });

 await page.goto('/');
 await expect(page.getByRole('region', { name: 'Pregled rada' })).toContainText('Danas nema merenja.');
});
