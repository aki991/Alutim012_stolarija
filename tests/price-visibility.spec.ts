import { test, expect } from '@playwright/test';

test('Režim bez cena ostaje sačuvan i dokument se prvo prikazuje', async ({ page }, testInfo) => {
 const job = '/posao/AT-2026-012';
 await page.setViewportSize({ width: 390, height: 844 });
 await page.goto('/podesavanja');
 const toggle = page.getByRole('checkbox', { name: /Prikaži cene/ });
 await expect(toggle).toBeChecked();
 await toggle.uncheck();
 await page.reload();
 await expect(toggle).not.toBeChecked();
 await page.goto('/cenovnik');
 await expect(page).toHaveURL(/\/podesavanja$/);
 await page.goto('/poslovi');
 await expect(page.locator('.job-card').first()).toBeVisible();
 await expect(page.locator('.job-card-value strong')).toHaveCount(0);
 await page.goto(job);
 await expect(page.locator('.job-line').first()).toBeVisible();
 await expect(page.locator('.line-price, .summary-price')).toHaveCount(0);
 await expect(page.getByRole('link', { name: 'Korekcija cene' })).toHaveCount(0);
 await page.goto(job + '/korekcija');
 await expect(page).toHaveURL(/\/ponuda$/);
 await expect(page.locator('.price-total')).toHaveCount(0);

 const downloads: string[] = [];
 page.on('download', file => downloads.push(file.suggestedFilename()));
 for (const name of ['Ponuda za kupca', 'Specifikacija za kancelariju']) {
  await page.getByRole('button', { name, exact: true }).click();
  const preview = page.getByRole('dialog', { name: `Pregled: ${name}` });
  await expect(preview.getByRole('img', { name: 'Strana 1 dokumenta' })).toBeVisible();
  expect(downloads).toHaveLength(name === 'Ponuda za kupca' ? 0 : 1);
  await preview.getByRole('button', { name: 'Sledeća' }).click();
  await expect(preview.getByRole('img', { name: 'Strana 2 dokumenta' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(name + '.png') });
  const pending = page.waitForEvent('download');
  await preview.getByRole('button', { name: 'Preuzmi PDF' }).click();
  const file = await pending;
  await file.saveAs(testInfo.outputPath(file.suggestedFilename()));
  await preview.getByRole('button', { name: 'Zatvori' }).click();
 }
 await page.goto('/podesavanja');
 await toggle.check();
 await page.goto(job + '/ponuda');
 await expect(page.getByTestId('quote-total')).toContainText('€');
});
