const { test, expect } = require('playwright/test');

test('bundle is grouped by actor in Swagger UI', async ({ page }) => {
  await page.goto('http://127.0.0.1:8080', { waitUntil: 'networkidle' });
  const sections = page.locator('.opblock-tag-section');
  await expect(sections).toHaveCount(6);

  const result = {};
  for (const section of await sections.all()) {
    const name = (await section.locator('.opblock-tag').innerText()).split('\n')[0].trim();
    result[name] = await section.locator('.opblock').count();
  }

  expect(Object.keys(result)).toEqual([
    '01 - Công khai và Tích hợp',
    '02 - Khách hàng (CUSTOMER)',
    '03 - Tài xế (DRIVER)',
    '04 - Nhân viên vận hành (OPERATOR)',
    '05 - Ban lãnh đạo (EXECUTIVE)',
    '06 - Quản trị viên (ADMIN)',
  ]);
  for (const count of Object.values(result)) expect(count).toBeGreaterThan(0);

  const sharedPath = '/api/v1/trips/{id}';
  for (const actor of ['02 - Khách hàng (CUSTOMER)', '03 - Tài xế (DRIVER)', '04 - Nhân viên vận hành (OPERATOR)']) {
    const section = sections.filter({ has: page.locator('.opblock-tag', { hasText: actor }) });
    await expect(section.locator('.opblock-summary-path', { hasText: sharedPath }).first()).toBeVisible();
  }
  console.log(JSON.stringify(result));
});
