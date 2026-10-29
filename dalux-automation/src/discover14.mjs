// src/discover14.mjs
// Select the "Håndverkerrapport" card and dump its contents (looking for the
// "Enkel" checkbox). Does NOT press the final "Skriv ut".

import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIST_URL =
  process.env.DALUX_LIST_URL ||
  'https://node1.build.dalux.com/client/725256/quality-control/forms/work-package/346256228113973674/workflow/346256228113973675/form/1405563';
const USER_DATA_DIR = path.join(__dirname, '..', 'user-data');

const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: false, viewport: { width: 1600, height: 950 }, slowMo: 90,
});
const page = context.pages()[0] ?? (await context.newPage());

await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(3000);
const lukk = page.getByRole('button', { name: /^lukk$/i });
if (await lukk.count()) { await lukk.first().click().catch(() => {}); await page.waitForTimeout(400); }

const newest = await page.evaluate(() => {
  const l = document.querySelector('dlx-text.dlx-underline-on-hover');
  return l ? (l.innerText || '').trim() : null;
});
console.log(`newest checklist row: ${newest}`);
if (!newest) { await context.close(); process.exit(1); }

await page.getByText(newest, { exact: true }).first().click({ timeout: 8000 });
await page.waitForTimeout(2000);

const win = page.locator('.dialog-window:visible').last();
await win.locator('.dialog-toolbar').getByRole('button', { name: /^skriv ut$/i }).first().click({ timeout: 8000 })
  .catch((e) => console.log('Skriv ut failed:', e.message.split('\n')[0]));
await page.waitForTimeout(2000);

// Tick "Ta med oppgaver".
const cbWrap = page.locator('.checkbox-wrapper').filter({ hasText: 'Ta med oppgaver' }).last();
await cbWrap.locator('input[type="checkbox"]').first().check({ force: true }).catch(async () => {
  await cbWrap.locator('.checkbox, .checkbox-background').first().click();
});
await page.waitForTimeout(1000);

// Select the Håndverkerrapport card.
const card = page.locator('dlx-field-print-button').filter({ hasText: 'Håndverkerrapport' }).first();
console.log(`\nHåndverkerrapport card matches: ${await card.count()}`);
await card.scrollIntoViewIfNeeded().catch(() => {});
await card.click({ timeout: 8000 }).catch((e) => console.log('card click failed:', e.message.split('\n')[0]));
await page.waitForTimeout(1800);

// Dump the card's HTML and every checkbox in the dialog.
const info = await page.evaluate(() => {
  const card = Array.from(document.querySelectorAll('dlx-field-print-button'))
    .find((n) => (n.innerText || '').includes('Håndverkerrapport'));
  const boxes = Array.from(document.querySelectorAll('.dialog-window .checkbox-wrapper')).map((w) => ({
    text: (w.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 50),
    checked: w.querySelector('input[type="checkbox"]')?.checked ?? null,
  }));
  return {
    cardHtml: card ? card.outerHTML.slice(0, 1800) : null,
    boxes,
  };
});
console.log('\n===== HÅNDVERKERRAPPORT CARD =====');
console.log(info.cardHtml);
console.log('\n===== ALL CHECKBOXES IN DIALOG =====');
info.boxes.forEach((b, i) => console.log(`[${i}] checked=${b.checked} "${b.text}"`));

await page.screenshot({ path: path.join(__dirname, '..', 'debug', 'discover14.png'), fullPage: true }).catch(() => {});
console.log('\nscreenshot: debug/discover14.png (no file generated)');

await context.close();
