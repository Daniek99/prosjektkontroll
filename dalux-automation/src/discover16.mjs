// src/discover16.mjs
// Find the "Deltakers vurdering av ryddighet/sikkerhet (1-7)" labels (anywhere
// in the checklist window) and dump their surroundings, to see how the grade
// value is rendered.

import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIST_URL =
  process.env.DALUX_LIST_URL ||
  'https://node1.build.dalux.com/client/725256/quality-control/forms/work-package/346256228113973674/workflow/346256228113973675/form/1405563';
const USER_DATA_DIR = path.join(__dirname, '..', 'user-data');

const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: false, viewport: { width: 1600, height: 950 }, slowMo: 80,
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
if (!newest) { await context.close(); process.exit(1); }
await page.getByText(newest, { exact: true }).first().click({ timeout: 8000 });
await page.waitForTimeout(2500);

const found = await page.evaluate(() => {
  const wins = Array.from(document.querySelectorAll('.dialog-window')).filter((w) => {
    const r = w.getBoundingClientRect();
    return r.width > 0 && w.querySelector('dlx-field-report-two-columns');
  });
  const win = wins[0];
  if (!win) return { error: 'no checklist window' };
  const out = [];
  for (const n of win.querySelectorAll('*')) {
    const t = (n.innerText || '').trim().replace(/\s+/g, ' ');
    if (!/^Deltakers vurdering av (ryddighet|sikkerhet) \(1-7\)$/i.test(t)) continue;
    // Climb to the keyColumn, then dump its PARENT (the row that also holds
    // the valueColumn with the grade).
    let keyCol = n;
    for (let i = 0; i < 4 && keyCol.parentElement; i++) {
      if ((keyCol.getAttribute('class') || '').includes('keyColumn')) break;
      keyCol = keyCol.parentElement;
    }
    const row = keyCol.parentElement || keyCol;
    out.push({ text: t, html: row.outerHTML.slice(0, 2500) });
  }
  return { count: out.length, rows: out };
});

if (found.error) { console.log(found.error); await context.close(); process.exit(1); }
console.log(`\nlabel rows found: ${found.count}`);
found.rows.forEach((r, i) => {
  console.log(`\n===== ROW ${i} =====`);
  console.log(r.html);
});

await context.close();
