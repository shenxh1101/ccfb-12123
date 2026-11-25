import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
});

async function loadDemo(page: import('@playwright/test').Page) {
  await page.goto('/#/import');
  await page.getByRole('button', { name: /^载入演示主机$/ }).first().click();
  await expect(page.getByText('已导入 5 台主机')).toBeVisible();
}

async function scanDemo(page: import('@playwright/test').Page) {
  await loadDemo(page);
  await page.getByRole('button', { name: /开始扫描/ }).click();
  await expect(page.getByText(/扫描完成/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.host-card')).toHaveCount(5);
}

test('dashboard, remediation and export work end to end', async ({ page }) => {
  await scanDemo(page);
  await expect(page.getByText('综合评分')).toBeVisible();
  await expect(page.locator('.host-card').filter({ hasText: 'db-02' }).getByText('32', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'e2e/screens/scan.png', fullPage: true });

  // Expand a host and verify evidence line numbers point at real files.
  await page.locator('.host-card').filter({ hasText: 'db-02' }).locator('.host-head').click();
  const row = page.locator('.result-row').first();
  await expect(row).toBeVisible();
  await row.locator('.result-head').click();
  await expect(row.locator('.evidence-head, .result-kv').first()).toBeVisible();
  await expect(row.locator('.code-line.hl').first()).toBeVisible();
  await page.screenshot({ path: 'e2e/screens/evidence.png' });

  // Rule deep-link from a result.
  await row.getByRole('button', { name: /查看规则定义/ }).click();
  await expect(page.getByRole('heading', { name: '检查项' })).toBeVisible();

  // Remediation → diff → rescan.
  await page.goto('/#/scan');
  await page.getByRole('button', { name: /生成整改方案/ }).click();
  await expect(page.getByRole('heading', { name: '整改建议' })).toBeVisible();
  await expect(page.locator('.diff-row.add').first()).toBeVisible();
  await expect(page.locator('.diff-row.del').first()).toBeVisible();
  await page.screenshot({ path: 'e2e/screens/remediation.png', fullPage: true });
  await page.getByRole('button', { name: /应用修复并重扫/ }).click();
  await expect(page.getByText(/已用修复后的配置重新扫描/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('修复前后对比')).toBeVisible();
  const improved = page.locator('.card').filter({ hasText: '修复前后对比' }).locator('tbody tr').filter({ hasText: 'db-02' });
  await expect(improved).toHaveCount(1);
  await expect(improved).toContainText('25.9');

  // Reports: JSON + Markdown downloads.
  await page.getByRole('button', { name: '报告导出', exact: false }).first().click();
  await expect(page.getByText('schema v1.0')).toBeVisible();
  let dl = page.waitForEvent('download');
  await page.getByRole('button', { name: /下载 JSON/ }).click();
  expect((await dl).suggestedFilename()).toMatch(/^baseline-report-.*\.json$/);
  dl = page.waitForEvent('download');
  await page.getByRole('button', { name: /下载 Markdown/ }).click();
  expect((await dl).suggestedFilename()).toMatch(/^baseline-report-.*\.md$/);
  await page.screenshot({ path: 'e2e/screens/report.png', fullPage: true });
});

test('rules page: all 55 sample pairs pass, definition and samples render', async ({ page }) => {
  await page.goto('/#/rules');
  await expect(page.getByText(/55 条规则/)).toBeVisible();
  await page.getByRole('button', { name: /校验全部样例/ }).click();
  await expect(page.getByText(/样例全部符合预期/)).toBeVisible({ timeout: 30_000 });
  await page.locator('.split tbody tr').first().click();
  await page.getByRole('button', { name: '通过 / 不通过样例' }).click();
  await expect(page.locator('.sample header').filter({ hasText: /^通过样例$/ })).toBeVisible();
  await expect(page.locator('.sample header').filter({ hasText: /^不通过样例$/ })).toBeVisible();
  await page.screenshot({ path: 'e2e/screens/rules.png', fullPage: true });
});

test('config view: include expansion and statement tree', async ({ page }) => {
  await loadDemo(page);
  await page.goto('/#/config');
  await page.getByRole('button', { name: 'SSH', exact: true }).click();
  await page.getByRole('button', { name: 'include 关系' }).click();
  await expect(page.getByRole('cell', { name: /sshd_config\.d\/\*\.conf/ }).first()).toBeVisible();
  await expect(page.getByText('已展开').first()).toBeVisible();
  await page.getByRole('button', { name: '指令树' }).click();
  await expect(page.locator('.tree')).toContainText('PermitRootLogin');
  await page.getByRole('button', { name: '源文件' }).click();
  await expect(page.locator('.code-line').first()).toBeVisible();
  await page.screenshot({ path: 'e2e/screens/config.png', fullPage: true });
});

test('batch import: 120-host fleet scans without freezing the UI', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByRole('button', { name: /生成 120 台压测数据/ }).click();
  await expect(page.getByText('已导入 120 台主机')).toBeVisible({ timeout: 30_000 });
  // The UI must stay responsive while a scan of 120 hosts runs in the worker.
  await page.getByRole('button', { name: /开始扫描/ }).click();
  const progress = page.locator('.progress');
  await expect(progress).toBeVisible();
  // Navigate away and back mid-scan: the app must not lock up.
  await page.getByRole('button', { name: /检查项/ }).first().click();
  await expect(page.getByRole('heading', { name: '检查项' })).toBeVisible();
  await page.getByRole('button', { name: /扫描结果/ }).first().click();
  await expect(page.getByText(/扫描完成/)).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.host-card')).toHaveCount(120);
});
