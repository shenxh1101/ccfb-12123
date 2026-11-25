import { test, expect } from '@playwright/test';
test('rule deep link pre-selects the rule', async ({ page }) => {
  await page.goto('/#/rules?rule=NGX-003');
  await expect(page.getByRole('heading', { name: '检查项' })).toBeVisible();
  await expect(page.locator('.card-title').filter({ hasText: '禁用弱 TLS 套件' })).toBeVisible();
  await expect(page.locator('tr').filter({ hasText: 'NGX-003' }).first()).toBeVisible();
});
