// src/discover15.mjs
// Dump how the vernerunde report stores its answers: the rating controls
// ("Deltakers vurdering av ryddighet/sikkerhet") and the free-text values
// (selectable-text), so the email draft can be generated from them.

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
console.log(`newest checklist row: ${newest}`);
if (!newest) { await context.close(); process.exit(1); }

await page.getByText(newest, { exact: true }).first().click({ timeout: 8000 });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const win = Array.from(document.querySelectorAll('.dialog-window'))
    .filter((w) => w.getBoundingClientRect().width > 0)
    .pop();

  // 1. Everything the user filled in (free text).
  const values = Array.from(win.querySelectorAll('.selectable-text'))
    .map((n) => (n.innerText || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean);

  // 2. The rating controls around the grade labels.
  const gradeBlocks = [];
  for (const label of ['ryddighet (1-7)', 'sikkerhet (1-7)', 'Samlet vurdering']) {
    const el = Array.from(win.querySelectorAll('*')).find(
      (n) => (n.innerText || '').trim().endsWith(label) && n.children.length <= 2
    );
    if (!el) { gradeBlocks.push({ label, found: false }); continue; }
    // climb to the row that holds the label + the rating control
    let row = el;
    for (let i = 0; i < 4 && row.parentElement; i++) {
      const t = (row.parentElement.innerText || '').trim();
      if (t.includes(label) && t.length < 80) { row = row.parentElement; break; }
      row = row.parentElement;
    }
    gradeBlocks.push({ label, found: true, html: row.outerHTML.slice(0, 900) });
  }

  return { values, gradeBlocks };
});

console.log('\n===== SELECTABLE TEXT VALUES (user-entered) =====');
info.values.forEach((v, i) => console.log(`[${i}] ${v}`));

console.log('\n===== GRADE CONTROLS =====');
for (const g of info.gradeBlocks) {
  console.log(`\n--- ${g.label} ---`);
  console.log(g.found ? g.html : 'NOT FOUND');
}

await page.screenshot({ path: path.join(__dirname, '..', 'debug', 'discover15.png'), fullPage: true }).catch(() => {});
await context.close();
