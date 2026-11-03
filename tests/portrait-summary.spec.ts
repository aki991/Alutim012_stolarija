import { test, expect } from '@playwright/test';

for (const width of [390, 600, 601, 620, 650, 700]) {
  test(`Lista elemenata bez prelivanja na ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 987 });
    await page.goto('/posao/AT-2026-012');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.job-line-head')).toBeHidden();
    const rows = page.locator('.job-line');
    expect(await rows.count()).toBeGreaterThan(0);
    for (const row of await rows.all()) {
      const bounds = await row.boundingBox();
      const name = await row.locator('.line-element').boundingBox();
      const dimensions = await row.locator('.line-dimensions').boundingBox();
      const price = await row.locator('.line-price').boundingBox();
      const tools = await row.locator('.line-tools').boundingBox();
      expect(name!.width).toBeGreaterThan(width * 0.5);
      expect(name!.x + name!.width).toBeLessThanOrEqual(tools!.x + 1);
      expect(dimensions!.y).toBeGreaterThanOrEqual(name!.y + name!.height - 1);
      expect(dimensions!.x + dimensions!.width).toBeLessThanOrEqual(price!.x + 1);
      for (const box of [name, dimensions, price, tools]) {
        expect(box!.x).toBeGreaterThanOrEqual(bounds!.x);
        expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
      }
      expect(await row.evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await expect(page.getByRole('navigation', { name: 'Donja navigacija' })).toBeVisible();
    await page.screenshot({ path: `test-results/portrait-summary-${width}.png` });
    await page.getByRole('link', { name: 'Izmeni element 1', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Dodatne opcije', exact: true })).toBeVisible();
  });
}
