import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('zip import round-trip: exported sample pack re-imports and scans', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByRole('button', { name: /^载入演示主机$/ }).first().click();
  await expect(page.getByText('已导入 5 台主机')).toBeVisible();

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: /导出样例配置包/ }).click();
  const download = await dl;
  const path = await download.path();
  expect(path).toBeTruthy();
  // Size sanity: the exported bundle must contain the actual configs.
  expect(readFileSync(path!).length).toBeGreaterThan(500);

  // Fresh page: import the zip and scan it.
  await page.goto('/');
  await page.goto('/#/import');
  await page.setInputFiles('input[type=file][multiple]:not([webkitdirectory])', path!);
  await expect(page.getByText(/已导入 5 台主机/)).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /开始扫描/ }).click();
  await expect(page.getByText(/扫描完成/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.host-card')).toHaveCount(5);
  await expect(page.locator('.host-card').filter({ hasText: 'db-02' })).toHaveCount(1);
});
