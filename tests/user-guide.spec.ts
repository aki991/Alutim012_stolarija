import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { guideChapters } from '../src/user-guide';

test('Uputstvo ima sadržaj i može da se otvori i preuzme bez interneta', async ({ page, context }) => {
 await page.setViewportSize({ width: 390, height: 844 });
 await page.goto('http://127.0.0.1:4187/podesavanja');
 await expect(page.getByRole('heading', { name: 'Podešavanja', exact: true })).toBeVisible();
 await page.evaluate(async () => {
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
   await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  }
 });
 await context.setOffline(true);
 try {
  await page.getByRole('checkbox', { name: /Prikaži cene/ }).uncheck();
  await page.getByRole('link', { name: /^Uputstvo/ }).click();
  await expect(page.getByRole('heading', { name: 'Uputstvo', exact: true })).toBeVisible();
  const contents = page.getByRole('navigation', { name: 'Sadržaj', exact: true });
  await expect(contents.getByRole('link')).toHaveText(guideChapters.map(chapter => chapter.title));
  await contents.getByRole('link', { name: 'Rad bez interneta i prenos u tim' }).click();
  await expect(page).toHaveURL(/\/podesavanja\/uputstvo#uputstvo-offline$/);
  const offline = page.getByRole('region', { name: 'Rad bez interneta i prenos u tim' });
  await expect(offline.getByRole('heading', { level: 2 })).toBeInViewport();
  await expect(offline).toContainText('Dodaj u bazu');
  await offline.getByRole('link', { name: 'Na sadržaj' }).click();
  await expect(contents.getByRole('heading')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Preuzmi PDF', exact: true }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toBe('ALU-TIM-012-Uputstvo.pdf');
  const output = test.info().outputPath(file.suggestedFilename());
  await file.saveAs(output);
  expect((await readFile(output)).subarray(0, 5).toString()).toBe('%PDF-');
 } finally {
  await context.setOffline(false);
 }
});
