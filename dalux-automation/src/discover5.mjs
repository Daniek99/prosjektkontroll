// src/discover5.mjs
// Open the registration modal (dlx-dialog), click the dialog's "Mer", then
// "Notifiser", and dump the menu + notify dialog. Does NOT press Send.

import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIELD_URL =
  process.env.DALUX_FIELD_URL ||
  'https://node1.build.dalux.com/client/725256/project-dashboard/dashboard';
const USER_DATA_DIR = path.join(__dirname, '..', 'user-data');

const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: false,
  viewport: { width: 1600, height: 950 },
  slowMo: 90,
});
const page = context.pages()[0] ?? (await context.newPage());

async function dumpInteractive(label) {
  const data = await page.evaluate(() => {
    const sel = [
      'button', 'a', '[role="button"]', '[role="menuitem"]', '[role="option"]',
      'input', 'textarea', 'label', '[role="checkbox"]', '[role="switch"]',
      '[role="listbox"]', 'dlx-dialog', 'dlx-dialog-footer', '[class*="dialog"]',
      '[class*="modal"]', '[class*="popover"]', '[class*="menu"]', '[class*="dropdown"]',
    ].join(',');
    const nodes = Array.from(document.querySelectorAll(sel));
    const out = [];
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      const s = getComputedStyle(n);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none') continue;
      const text = (n.innerText || n.value || '').trim().replace(/\s+/g, ' ').slice(0, 45);
      const cls = typeof n.className === 'string' ? n.className.slice(0, 55) : '';
      out.push({
        tag: n.tagName.toLowerCase(),
        role: n.getAttribute('role') || '',
        type: n.getAttribute('type') || '',
        checked: n.checked ?? n.getAttribute('aria-checked') ?? '',
        text, cls, y: Math.round(r.top), x: Math.round(r.left),
      });
    }
    return out;
  });
  console.log(`\n===== ${label} =====`);
  data.forEach((d, i) =>
    console.log(
      `[${i}] ${d.tag}${d.role ? ` role=${d.role}` : ''}${d.type ? ` type=${d.type}` : ''}${d.checked !== '' ? ` checked=${d.checked}` : ''} @(${d.x},${d.y}) .${d.cls} "${d.text}"`
    )
  );
}

async function clickText(text, label, exact = false) {
  const loc = page.getByText(text, { exact });
  const c = await loc.count();
  console.log(`\n>>> click "${label ?? text}" (${c} match${c === 1 ? '' : 'es'})`);
  if (!c) return false;
  try {
    await loc.first().scrollIntoViewIfNeeded().catch(() => {});
    await loc.first().click({ timeout: 8000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1200);
    return true;
  } catch (e) { console.log('    failed:', e.message.split('\n')[0]); return false; }
}

await page.goto(FIELD_URL, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(2000);
const lukk = page.getByRole('button', { name: /^lukk$/i });
if (await lukk.count()) { await lukk.first().click().catch(() => {}); await page.waitForTimeout(500); }
await page.getByRole('button', { name: /^field/i }).first().click({ timeout: 8000 }).catch(() => {});
await page.getByText('Sjekklister', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);

await clickText('Sjekklister', 'Sjekklister');
await clickText('22. HMS', '22. HMS');
await clickText('Til verneleder', 'Til verneleder');
await clickText('Verne- og miljørunde', 'Verne- og miljørunde');
await page.waitForTimeout(1500);

// Open the registration modal.
await page.locator('dlx-text.dlx-underline-on-hover').first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1500);

const dlg = page.locator('dlx-dialog').last();
const hasDialog = (await page.locator('dlx-dialog').count()) > 0;
console.log(`\ndlx-dialog count: ${await page.locator('dlx-dialog').count()}`);
await dumpInteractive('after open modal');

// Click "Mer" INSIDE the dialog.
if (hasDialog) {
  const mer = dlg.getByText('Mer', { exact: true });
  console.log(`\n>>> dialog "Mer" matches: ${await mer.count()}`);
  await mer.last().click({ timeout: 8000 }).catch((e) => console.log('    failed:', e.message.split('\n')[0]));
  await page.waitForTimeout(800);
  await dumpInteractive('after dialog Mer');
}

// Click "Notifiser" (menu popup may be outside the dialog).
await clickText('Notifiser', 'Notifiser');
await page.waitForTimeout(1500);
await dumpInteractive('after Notifiser');

await page.screenshot({ path: path.join(__dirname, '..', 'debug', 'discover5.png'), fullPage: true }).catch(() => {});
console.log('\nscreenshot: debug/discover5.png (NOT sending anything)');

await context.close();
