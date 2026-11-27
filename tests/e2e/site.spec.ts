import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { lessonUrls, listUrls } from './pages';

/** Fails the test on any console error or uncaught exception. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}
async function noSideScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, 'page scrolls sideways').toBeLessThanOrEqual(cw + 1);
}
async function noSeriousA11yIssues(page: Page) {
  // axe ships its own playwright-core types; the runtime object is the same page.
  type AxePage = ConstructorParameters<typeof AxeBuilder>[0]['page'];
  const r = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target}`)).toEqual([]);
}

for (const url of listUrls) {
  test(`page ${url} loads cleanly`, async ({ page }) => {
    const errors = watchErrors(page);
    const res = await page.goto(url);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await noSideScroll(page);
    await noSeriousA11yIssues(page);
    expect(errors).toEqual([]);
  });
}

for (const url of lessonUrls) {
  test(`lesson ${url} works end to end`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(url);
    const steps = page.locator('#lesson > section.step');
    await expect(steps).toHaveCount(await steps.count());
    expect(await steps.count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('section.athome tbody tr').first()).toBeVisible();

    // See: Start then Next moves the dots.
    const see = steps.first();
    await see.getByRole('button', { name: /Start/ }).click();
    await see.getByRole('button', { name: /Next/ }).click();
    await expect(see.locator('.dots span.on')).toHaveCount(1);
    await expect(see.locator('.dots span').nth(1)).toHaveClass(/on/);

    // Check: answering shows feedback and a score.
    const check = steps.last();
    await check.locator('.qopt').first().click();
    await expect(check.locator('.qfb')).toHaveClass(/qfb (ok|no)/);
    await expect(check.locator('.score')).toHaveText(/of 1 right/);

    await noSideScroll(page);
    await noSeriousA11yIssues(page);
    expect(errors).toEqual([]);
  });
}

test('sound choice is remembered after reload', async ({ page }) => {
  await page.goto('/');
  const toggle = page.locator('#sound-toggle');
  await expect(toggle).toHaveText(/Sound on/);
  await toggle.click();
  await expect(toggle).toHaveText(/Sound off/);
  await page.reload();
  await expect(page.locator('#sound-toggle')).toHaveText(/Sound off/);
});

test('unknown pages show the friendly 404', async ({ page }) => {
  const res = await page.goto('/no-such-page/');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('Oops');
});

test('no ad markup while ads are switched off', async ({ page }) => {
  await page.goto(lessonUrls[0]);
  await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
});
