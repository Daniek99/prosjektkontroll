// src/discover4.mjs
// Open the first (unfinished) registration in the Verne- og miljørunde list,
// click "Mer" then "Notifiser", and dump the menu + dialog structure.
// Does NOT press Send.

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
      '[role="tab"]', 'input', 'textarea', 'label', '[role="checkbox"]',
      '[role="listbox"]', '[role="dialog"]', '[role="switch"]',
    ].join(',');
    const nodes = Array.from(document.querySelectorAll(sel));
    const out = [];
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      const s = getComputedStyle(n);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none') continue;
      const text = (n.innerText || n.value || '').trim().replace(/\s+/g, ' ').slice(0, 50);
      const cls = typeof n.className === 'string' ? n.className.slice(0, 55) : '';
      out.push({
        tag: n.tagName.toLowerCase(),
        role: n.getAttribute('role') || '',
        type: n.getAttribute('type') || '',
        checked: n.checked ?? n.getAttribute('aria-checked') ?? '',
        text,
        cls,
        y: Math.round(r.top),
      });
    }
    return out;
  });
  console.log(`\n===== ${label}  (url: ${page.url()}) =====`);
  data.forEach((d, i) =>
    console.log(
      `[${i}] ${d.tag}${d.role ? ` role=${d.role}` : ''}${d.type ? ` type=${d.type}` : ''}${d.checked !== '' ? ` checked=${d.checked}` : ''} y=${d.y} .${d.cls} "${d.text}"`
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
    console.log('    ok ->', page.url());
    return true;
  } catch (e) {
    console.log('    failed:', e.message.split('\n')[0]);
    return false;
  }
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

// Open the first (unfinished) registration row via its "Nr." link.
const nrLink = page.locator('dlx-text.dlx-underline-on-hover').first();
console.log(`\n>>> open first registration (nr links: ${await page.locator('dlx-text.dlx-underline-on-hover').count()})`);
await nrLink.scrollIntoViewIfNeeded().catch(() => {});
await nrLink.click({ timeout: 8000 }).catch((e) => console.log('    failed:', e.message.split('\n')[0]));
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(1500);
await dumpInteractive('after opening registration');

await clickText('Mer', 'Mer', true);
await page.waitForTimeout(800);
await dumpInteractive('after Mer');

await clickText('Notifiser', 'Notifiser');
await page.waitForTimeout(1200);
await dumpInteractive('after Notifiser');

await page.screenshot({ path: path.join(__dirname, '..', 'debug', 'discover4.png'), fullPage: true }).catch(() => {});
console.log('\nscreenshot: debug/discover4.png (NOT sending anything)');

await context.close();
