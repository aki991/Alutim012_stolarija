import { expect, test, type Page } from '@playwright/test';
import type { LocalSnapshot } from '../src/services/storage';

const localWorkspaceKey = 'alu-tim-teren-v1';
const firstJob = 'AT-2026-012';
const secondJob = 'AT-2026-011';
const status = (page: Page) => page.getByRole('combobox', { name: /Status posla/ });

function stored(page: Page): Promise<LocalSnapshot> {
 return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), localWorkspaceKey);
}

test('Čuvanje iz zastarelog taba zadržava izmene na drugom poslu', async ({ page, context }) => {
 const staleTab = await context.newPage();
 await staleTab.addInitScript(() => {
  window.addEventListener('storage', event => event.stopImmediatePropagation(), { capture: true });
 });
 await page.goto('/posao/' + firstJob);
 await staleTab.goto('/posao/' + secondJob);
 await expect(status(staleTab)).toHaveValue('Ponuda');

 await status(page).selectOption('Završeno');
 await status(staleTab).selectOption('Odbijeno');
 const { jobs } = await stored(staleTab);
 expect(jobs.find(job => job.id === firstJob)?.status).toBe('Završeno');
 expect(jobs.find(job => job.id === secondJob)?.status).toBe('Odbijeno');
 await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Zastareli tab prijavi konflikt kada je isti posao već promenjen', async ({ page, context }) => {
 const staleTab = await context.newPage();
 await staleTab.addInitScript(() => {
  window.addEventListener('storage', event => event.stopImmediatePropagation(), { capture: true });
 });
 await page.goto('/posao/' + firstJob);
 await staleTab.goto('/posao/' + firstJob);
 await status(page).selectOption('Završeno');
 await status(staleTab).selectOption('Odbijeno');

 await expect(staleTab.getByRole('alert')).toContainText('Isti lokalni podatak je izmenjen u drugom tabu.');
 expect((await stored(staleTab)).jobs.find(job => job.id === firstJob)?.status).toBe('Završeno');
});

test('Oštećen posao nema uticaj na oporavak i ponovno čuvanje drugih poslova', async ({ page }) => {
 await page.goto('/posao/' + firstJob);
 const original = await page.evaluate(key => {
  const data = JSON.parse(localStorage.getItem(key)!);
  data.jobs[0].customer.name = 'Posao za oporavak';
  data.jobs[1].positions[0].quantity = null;
  const raw = JSON.stringify(data);
  localStorage.setItem(key, raw);
  return raw;
 }, localWorkspaceKey);
 await page.reload();
 await expect(page.getByRole('alert')).toContainText('Učitani su ispravni zapisi.');
 await expect(page.getByRole('heading', { name: 'Posao: Posao za oporavak' })).toBeVisible();
 await status(page).selectOption('Završeno');

 const { jobs } = await stored(page);
 expect(jobs.find(job => job.id === firstJob)).toMatchObject({ customer: { name: 'Posao za oporavak' }, status: 'Završeno' });
 expect(jobs.some(job => job.id === secondJob)).toBe(false);
 expect(await page.evaluate(key => localStorage.getItem(key + ':recovery:0'), localWorkspaceKey)).toBe(original);
});

test('Izvoz i ponovni uvoz čuvaju posao u korpi i njegove pozicije', async ({ page }) => {
 await page.goto('/podesavanja/podaci');
 const initial = await stored(page);
 const moved = initial.jobs.pop()!;
 initial.trash.push({ job: moved, deletedAt: '2026-11-16T12:00:00Z' });
 await page.evaluate(({ key, initial }) => localStorage.setItem(key, JSON.stringify(initial)), { key: localWorkspaceKey, initial });
 await page.reload();
 const download = page.waitForEvent('download');
 await page.getByRole('button', { name: 'Izvezi rezervnu kopiju' }).click();
 const backupFile = test.info().outputPath('rezervna-kopija.json');
 await (await download).saveAs(backupFile);

 await page.evaluate(key => {
  const data = JSON.parse(localStorage.getItem(key)!);
  data.trash = [];
  localStorage.setItem(key, JSON.stringify(data));
 }, localWorkspaceKey);
 await page.reload();
 page.once('dialog', dialog => dialog.accept());
 await page.locator('input[type=file]').setInputFiles(backupFile);
 await expect(page.getByText('Rezervna kopija je uvezena.')).toBeVisible();
 expect(await stored(page)).toEqual(initial);
 await page.goto('/korpa');
 await expect(page.getByText(moved.customer.name, { exact: true })).toBeVisible();
});

test('Neuspešan upis kopije ne prijavljuje uspeh niti menja učitane poslove', async ({ page }) => {
 await page.goto('/podesavanja/podaci');
 const original = await stored(page);
 const changed = { ...original, jobs: [], settings: { ...original.settings, technician: 'Importovani majstor' } };
 await page.evaluate(key => {
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (name, value) {
   if (this === localStorage && name === key) throw new DOMException('Quota exceeded', 'QuotaExceededError');
   return setItem.call(this, name, value);
  };
 }, localWorkspaceKey);
 page.once('dialog', dialog => dialog.accept());
 await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(changed)) });
 await expect(page.getByText('Rezervna kopija nije sačuvana na uređaju.')).toBeVisible();
 await expect(page.getByLabel('Ime majstora')).toHaveValue(original.settings.technician);
 expect(await stored(page)).toEqual(original);
});

test('Ponovni pokušaj čuvanja elementa posle pune memorije ne dodaje duplikat', async ({ page }) => {
 await page.goto('/posao/' + firstJob + '/nov/prozor');
 const count = (await stored(page)).jobs.find(job => job.id === firstJob)!.positions.length;
 await page.evaluate(key => {
  const setItem = Storage.prototype.setItem;
  sessionStorage.setItem('block-local-save', 'true');
  Storage.prototype.setItem = function (name, value) {
   if (this === localStorage && name === key && sessionStorage.getItem('block-local-save')) {
    throw new DOMException('Quota exceeded', 'QuotaExceededError');
   }
   return setItem.call(this, name, value);
  };
 }, localWorkspaceKey);
 const save = page.getByRole('button', { name: 'Dodaj u posao', exact: true });
 await save.click();
 await expect(page.getByText('Element nije sačuvan. Proverite prostor na uređaju i pokušajte ponovo.')).toBeVisible();
 await expect(page).toHaveURL(/\/nov\/prozor$/);
 expect((await stored(page)).jobs.find(job => job.id === firstJob)?.positions).toHaveLength(count);

 await page.evaluate(() => sessionStorage.removeItem('block-local-save'));
 await save.click();
 await expect(page).toHaveURL(/\/posao\/AT-2026-012$/);
 expect((await stored(page)).jobs.find(job => job.id === firstJob)?.positions).toHaveLength(count + 1);
});
