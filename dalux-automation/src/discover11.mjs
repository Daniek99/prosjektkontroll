// src/discover11.mjs
// Probe the print dialog: open the newest checklist, press "Skriv ut", and dump
// the dialog (checkboxes / report icons / buttons). Does NOT press the final
// "Skriv ut", so no file is generated.

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

async function dumpInteractive(label) {
  const data = await page.evaluate(() => {
    const sel = [
      'button', 'a', '[role="button"]', '[role="menuitem"]', '[role="option"]',
      'input', 'textarea', 'label', '[role="checkbox"]', '[role="switch"]',
      '[role="radio"]', '[class*="checkbox"]', '[class*="radio"]', '[class*="icon"]',
      '[class*="report"]', '[class*="card"]', '[class*="tile"]', 'dlx-icon',
    ].join(',');
    const nodes = Array.from(document.querySelectorAll(sel));
    const out = [];
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      const s = getComputedStyle(n);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none') continue;
      const text = (n.innerText || n.value || n.getAttribute('aria-label') || n.getAttribute('title') || '')
        .trim().replace(/\s+/g, ' ').slice(0, 50);
      const cls = typeof n.className === 'string' ? n.className.slice(0, 60) : '';
      out.push({
        tag: n.tagName.toLowerCase(), role: n.getAttribute('role') || '',
        type: n.getAttribute('type') || '',
        checked: n.checked ?? n.getAttribute('aria-checked') ?? '',
        text, cls, x: Math.round(r.left), y: Math.round(r.top),
      });
    }
    return out;
  });
  console.log(`\n===== ${label} =====`);
  data.forEach((d, i) =>
    console.log(`[${i}] ${d.tag}${d.role ? ` role=${d.role}` : ''}${d.type ? ` type=${d.type}` : ''}${d.checked !== '' ? ` checked=${d.checked}` : ''} @(${d.x},${d.y}) .${d.cls} "${d.text}"`)
  );
}

await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(3000);
const lukk = page.getByRole('button', { name: /^lukk$/i });
if (await lukk.count()) { await lukk.first().click().catch(() => {}); await page.waitForTimeout(400); }

// The newest checklist = the first row in the list (sorted by Endringsdato desc).
const newest = await page.evaluate(() => {
  const l = document.querySelector('dlx-text.dlx-underline-on-hover');
  return l ? (l.innerText || '').trim() : null;
});
console.log(`newest checklist row: ${newest}`);
if (!newest) { await context.close(); process.exit(1); }

await page.getByText(newest, { exact: true }).first().click({ timeout: 8000 });
await page.waitForTimeout(2000);
console.log('windows after opening checklist:', await page.locator('.dialog-window:visible').count());

// Press "Skriv ut" in the checklist window toolbar.
const win = page.locator('.dialog-window:visible').last();
await win.locator('.dialog-toolbar').getByRole('button', { name: /^skriv ut$/i }).first().click({ timeout: 8000 })
  .catch((e) => console.log('Skriv ut failed:', e.message.split('\n')[0]));
await page.waitForTimeout(2000);
await dumpInteractive('after Skriv ut (print dialog)');

await page.screenshot({ path: path.join(__dirname, '..', 'debug', 'discover11.png'), fullPage: true }).catch(() => {});
console.log('\nscreenshot: debug/discover11.png (no file generated)');

await context.close();
