// src/discover.mjs
//
// One-off helper: walks the Dalux navigation and prints the visible, clickable
// elements at each step, so we can build accurate selectors for
// dalux-field-purring.mjs instead of guessing.
//
// Run:  npm run login   (once, to save the session)
//       node src/discover.mjs
//
// Read-only: it only clicks navigation and screenshots; it never changes or
// sends anything.

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
  slowMo: 100,
});
const page = context.pages()[0] ?? (await context.newPage());

async function snapshot(label) {
  const data = await page.evaluate(() => {
    const sel = [
      'button', 'a', '[role="button"]', '[role="tab"]', '[role="treeitem"]',
      '[role="menuitem"]', '[role="option"]', '[class*="nav"]', '[class*="item-wrapper"]',
    ].join(',');
    const nodes = Array.from(document.querySelectorAll(sel));
    const out = [];
    const seen = new Set();
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      const s = getComputedStyle(n);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none') continue;
      const text = (n.innerText || '').trim().replace(/\s+/g, ' ');
      if (!text || text.length > 45) continue;
      const key = `${n.tagName}|${n.getAttribute('role') || ''}|${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cls = typeof n.className === 'string' ? n.className.split(' ').slice(0, 2).join('.') : '';
      out.push({ tag: n.tagName.toLowerCase(), role: n.getAttribute('role') || '', text, cls, bg: s.backgroundColor });
    }
    return out;
  });
  console.log(`\n===== ${label} =====\nurl: ${page.url()}`);
  data.forEach((d, i) => {
    console.log(`[${i}] <${d.tag}${d.role ? ` role=${d.role}` : ''}> "${d.text}"  .${d.cls}  bg=${d.bg}`);
  });
}

async function waitClick(text, label, { timeout = 30000, exact = false } = {}) {
  const loc = page.getByText(text, { exact });
  console.log(`\n>> wait+click "${label ?? text}"`);
  try {
    await loc.first().waitFor({ state: 'visible', timeout });
    await loc.first().scrollIntoViewIfNeeded().catch(() => {});
    await loc.first().click({ timeout: 8000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1200);
    console.log('   ok');
    return true;
  } catch (e) {
    console.log(`   FAILED: ${e.message.split('\n')[0]}`);
    return false;
  }
}

await page.goto(FIELD_URL, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(2000);
await snapshot('00-loaded');

// Dismiss any overlay dialog.
const lukk = page.getByRole('button', { name: /^lukk$/i });
if (await lukk.count()) {
  await lukk.first().click().catch(() => {});
  await page.waitForTimeout(600);
}

// Enter the Field module (left nav "Field 71" -> /quality-control/home).
await page.getByRole('button', { name: /^field/i }).first().click({ timeout: 8000 }).catch(() => {});
await page.waitForLoadState('networkidle').catch(() => {});

// Wait for the Field sidebar to render before proceeding.
await page.getByText('Sjekklister', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1000);
await snapshot('01-field');

// Sidebar tree: Sjekklister is already expanded -> 22. HMS -> Til verneleder -> ...
await waitClick('22. HMS', '22. HMS');
await snapshot('02-22hms');

await waitClick('Til verneleder', 'Til verneleder');
await snapshot('03-til-verneleder');

await waitClick('Verne- og miljørunde', 'Verne- og miljørunde');
await snapshot('04-vernemiljorunde');

const shot = path.join(__dirname, '..', 'debug', 'discover-final.png');
await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
console.log(`\nfinal screenshot: ${shot}`);

await context.close();
