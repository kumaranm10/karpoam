#!/usr/bin/env node
/**
 * Screenshots of the home page for the Gemini design lane: phone 390px and desktop 1280px,
 * light and dark. Needs the site running (npm run preview) at BASE (default http://localhost:4321).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const OUT = process.env.SHOTS ?? 'shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const [device, width, height] of [
  ['phone', 390, 844],
  ['desktop', 1280, 900],
]) {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(OUT, `home-${device}-${scheme}.png`), fullPage: true });
    await page.close();
  }
}
await browser.close();
console.log(`Screenshots saved to ${OUT}/`);
