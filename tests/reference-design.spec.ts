import { test, expect } from '@playwright/test';

test('Donje akcije ne prekrivaju skrolovanu radnu površinu', async ({page}) => {
  for (const viewport of [{width:1024,height:768},{width:768,height:1024},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    for (const [route,main,footer] of [
      ['/posao/AT-2026-012/nov/prozor','.measurement-workspace','.measurement-footer'],
      ['/posao/AT-2026-012','.job-summary','.field-bottom-actions'],
      ['/posao/AT-2026-012/ponuda','.price-workspace','.field-bottom-actions']
    ]) {
      await page.goto(route);
      const content=await page.locator(main).boundingBox(), actions=await page.locator(footer).boundingBox();
      expect(content!.y+content!.height).toBeLessThanOrEqual(actions!.y+1);
      expect(actions!.y+actions!.height).toBeLessThanOrEqual(viewport.height+1);
    }
  }
});

test('Početna prati referentni raspored na telefonu i tabletu', async ({ page }) => {
  for (const viewport of [{ width: 302, height: 670 }, { width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1366, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('heading', { name: 'Brza ponuda na terenu' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Vrste stolarije' }).getByRole('link')).toHaveCount(6);
    const category = await page.locator('.reference-categories').boundingBox();
    const hero = await page.locator('.reference-hero').boundingBox();
    const jobs = await page.locator('.reference-active').boundingBox();
    expect(category!.y).toBeGreaterThanOrEqual(hero!.y + hero!.height);
    expect(jobs!.y).toBeGreaterThan(category!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/reference-${viewport.width}.png`, fullPage: true });
  }
});

test('Mobilni meni, kategorije, posao i obaveštenja ostaju funkcionalni', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Vrste stolarije' }).getByRole('link', { name: 'Prozori', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Katalog elemenata' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Donja navigacija' }).getByRole('link', { name: 'Početna', exact: true }).click();
  await page.locator('.reference-job').first().click();
  await expect(page.getByRole('heading', { name: 'Posao: Porodica Petrović', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Donja navigacija' }).getByRole('link', { name: 'Početna', exact: true }).click();
  await page.getByRole('navigation', { name: 'Donja navigacija' }).getByRole('button', { name: 'Više', exact: true }).click();
  await page.getByRole('dialog', { name: 'Više' }).getByRole('link', { name: 'Ponude', exact: true }).click();
  await page.getByRole('navigation', { name: 'Donja navigacija' }).getByRole('link', { name: 'Početna', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Brza ponuda na terenu' })).toBeVisible();
  await page.getByRole('button', { name: 'Obaveštenja' }).click();
  await expect(page.getByRole('dialog', { name: 'Za tehničku proveru' })).toBeVisible();
});
