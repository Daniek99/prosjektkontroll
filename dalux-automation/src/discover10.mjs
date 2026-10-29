// src/discover10.mjs
// Click an orange Gjør#### chip inside the checklist window and dump the window
// that opens (the task window) — its title and toolbar buttons. Read-only.

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

const orangeRow = await page.evaluate(() => {
  const isOrange = (c) => {
    const m = c && c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return false;
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return r >= 230 && g >= 70 && g <= 170 && b <= 70;
  };
  for (const l of document.querySelectorAll('dlx-text.dlx-underline-on-hover')) {
    let row = l;
    while (row.parentElement && row.parentElement.querySelectorAll('dlx-text.dlx-underline-on-hover').length === 1) {
      row = row.parentElement;
    }
    const dot = Array.from(row.querySelectorAll('div')).find((n) => {
      const s = getComputedStyle(n);
      const w = n.getBoundingClientRect().width;
      return w > 4 && w < 20 && (parseFloat(s.borderRadius) || 0) >= 20 && isOrange(s.backgroundColor);
    });
    if (dot) return (l.innerText || '').trim();
  }
  return null;
});
console.log(`orange checklist row: ${orangeRow}`);
if (!orangeRow) { await context.close(); process.exit(1); }

await page.getByText(orangeRow, { exact: true }).first().click({ timeout: 8000 });
await page.waitForTimeout(2000);
console.log('windows after opening checklist:', await page.locator('.dialog-window').count());

const chipCount = await page.locator('[data-cy="attached-tasks-chip"]').count();
console.log('chips (data-cy=attached-tasks-chip):', chipCount);

// Click the first chip.
const chip = page.locator('[data-cy="attached-tasks-chip"]').first();
await chip.scrollIntoViewIfNeeded().catch(() => {});
await chip.click({ timeout: 8000 }).catch((e) => console.log('chip click failed:', e.message.split('\n')[0]));
await page.waitForTimeout(2000);

const winCount = await page.locator('.dialog-window').count();
console.log('windows after clicking chip:', winCount);

const last = page.locator('.dialog-window').last();
const title = (await last.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120);
console.log('topmost window text:', title);

const toolbars = await last.locator('.dialog-toolbar').count();
console.log('toolbars in topmost window:', toolbars);
if (toolbars) {
  const btns = await last.locator('.dialog-toolbar').last().locator('button').allInnerTexts();
  console.log('toolbar buttons:', JSON.stringify(btns));
}

await page.screenshot({ path: path.join(__dirname, '..', 'debug', 'discover10.png'), fullPage: true }).catch(() => {});
console.log('\nscreenshot: debug/discover10.png (read-only)');

await context.close();
