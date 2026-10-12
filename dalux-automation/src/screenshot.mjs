// src/screenshot.mjs
// Minimal template that reuses the saved Dalux session (./user-data) and does
// something on the page. Copy this file as the starting point for each of your
// real operations (the ones you record with `npm run codegen`).
//
// Run:  npm run screenshot
//
// Requires that `npm run login` has been run at least once.
//
// Third-party automation note: only use this against an account you are
// authorised to access, and respect Dalux's terms of service.

import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const START_URL =
  'https://node1.build.dalux.com/client/725256/project-dashboard/dashboard';
const USER_DATA_DIR = path.join(__dirname, '..', 'user-data');
const SHOT_PATH = path.join(__dirname, '..', 'dalux-dashboard.png');
// ──────────────────────────────────────────────────────────────────────────────

const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: false,
  viewport: { width: 1440, height: 900 },
});

const page = context.pages()[0] ?? (await context.newPage());

// Dalux is a heavy SPA; wait for the app shell rather than just DOMContentLoaded.
await page.goto(START_URL, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => {});

// ── Do work here ──────────────────────────────────────────────────────────────
// Example: confirm we are really inside the project (not bounced to a login page).
console.log('URL:  ', page.url());
console.log('Title:', await page.title());

// If this looks like a sign-in page, your session expired -> run `npm run login`.
if (/login|signin|auth/i.test(page.url())) {
  console.warn('\n⚠ Looks like you were redirected to a login page.');
  console.warn('  Run `npm run login` to refresh the saved session.\n');
}

// Take a full-page screenshot so you can inspect the real DOM/UI.
await page.screenshot({ path: SHOT_PATH, fullPage: true });
console.log(`Screenshot written to ${SHOT_PATH}`);

// ── Example of how to interact ────────────────────────────────────────────────
// Prefer resilient, human-readable locators over brittle CSS paths:
//
//   await page.getByRole('button', { name: 'New task' }).click();
//   await page.getByLabel('Title').fill('Erect scaffold');
//   await page.getByText('Save').click();
//
// Or capture structured data:
//
//   const rows = await page.locator('[data-testid="task-row"]').allInnerTexts();
//   console.log(rows);
// ──────────────────────────────────────────────────────────────────────────────

await context.close();
