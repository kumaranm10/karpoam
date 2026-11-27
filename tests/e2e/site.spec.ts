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
/**
 * Tamil script is only for Tamil pages and the logo (Kumaran, 27 Nov).
 * Allowed elsewhere: the header logo (.brand) and the Tamil subject's own icon (அ) in its links.
 * Checks visible text, <title>, meta tags and text-bearing attributes (alt, aria-label, title, placeholder).
 */
async function tamilOnlyWhereAllowed(page: Page, url: string) {
  if (url.startsWith('/tamil/')) return;
  const found = await page.evaluate(() => {
    const ta = /[\u0B80-\u0BFF]+/g;
    const doc = document.documentElement.cloneNode(true) as HTMLElement;
    for (const el of doc.querySelectorAll('.brand, [data-subject="tamil"] [aria-hidden="true"]')) el.remove();
    const parts = [doc.querySelector('body')?.textContent ?? '', document.title];
    for (const el of doc.querySelectorAll('meta[content]')) parts.push(el.getAttribute('content') ?? '');
    for (const a of ['alt', 'aria-label', 'title', 'placeholder']) for (const el of doc.querySelectorAll(`[${a}]`)) parts.push(el.getAttribute(a) ?? '');
    return parts.join(' ').match(ta) ?? [];
  });
  expect(found, `Tamil text on ${url}`).toEqual([]);
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
    await tamilOnlyWhereAllowed(page, url);
    await noSeriousA11yIssues(page);
    expect(errors).toEqual([]);
  });
}

for (const url of lessonUrls) {
  test(`lesson ${url} works end to end`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(url);
    await tamilOnlyWhereAllowed(page, url);
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
  await tamilOnlyWhereAllowed(page, '/no-such-page/');
});

test('no ad markup while ads are switched off', async ({ page }) => {
  await page.goto(lessonUrls[0]);
  await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
});

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test(`home hero cookies match the sums (motion: ${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/');
    const plates = page.locator('.demo-plate');
    await expect(plates).toHaveCount(3);
    const perPlate = await plates.evaluateAll((els) => els.map((e) => [...(e.textContent ?? '')].filter((c) => c === '🍪').length));
    expect(perPlate).toEqual([4, 4, 4]);
    await expect(page.locator('.demo-eq')).toHaveText(/4\s*\+\s*4\s*\+\s*4\s*=\s*12/);
    await expect(page.locator('.demo-times')).toHaveText(/3\s*×\s*4\s*=\s*12/);
    // Motion loops gently; within one build-up (≤ 4.2 s) all plates and both sums are fully visible together.
    await expect(page.locator('.demo-times')).toHaveCSS('opacity', '1', { timeout: 7000 });
    await expect(plates.nth(2)).toHaveCSS('opacity', '1');
    await expect(page.locator('.demo-eq')).toHaveCSS('opacity', '1');
    const loop = await page.locator('.demo-times').evaluate((e) => getComputedStyle(e).animationIterationCount);
    expect(loop).toBe(reducedMotion === 'reduce' ? '1' : 'infinite');
    const icons = await page.locator('.stile .stile-icon').evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName));
    expect(icons.every((n) => (reducedMotion === 'reduce' ? n === 'none' : n.startsWith('ic-')))).toBe(true);
  });
}
