// src/discover2.mjs
// Probe the Field left sidebar tree: prints labels, tags, classes and the URL
// before/after each click so we can target the right elements.

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
  slowMo: 80,
});
const page = context.pages()[0] ?? (await context.newPage());

async function dumpSidebar(label) {
  const items = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const out = [];
    for (const n of all) {
      const r = n.getBoundingClientRect();
      if (!(r.left < 340 && r.width > 0 && r.height > 0 && r.top > 40)) continue;
      const t = (n.innerText || '').trim().replace(/\s+/g, ' ');
      if (!t || t.length > 42) continue;
      const childSame = Array.from(n.children).some(
        (c) => (c.innerText || '').trim().replace(/\s+/g, ' ') === t
      );
      if (childSame) continue;
      const cls = typeof n.className === 'string' ? n.className.slice(0, 70) : '';
      out.push({ tag: n.tagName.toLowerCase(), cls, t, top: Math.round(r.top), left: Math.round(r.left) });
    }
    return out;
  });
  console.log(`\n----- SIDEBAR ${label}  (url: ${page.url()}) -----`);
  items.forEach((d, i) => console.log(`[${i}] ${d.tag} .${d.cls} @(${d.left},${d.top}) "${d.t}"`));
}

async function clickLabel(text, label) {
  console.log(`\n>>> click "${label ?? text}"`);
  const loc = page.getByText(text, { exact: false });
  const c = await loc.count();
  console.log(`    matches: ${c}`);
  if (!c) return;
  try {
    await loc.first().scrollIntoViewIfNeeded().catch(() => {});
    await loc.first().click({ timeout: 8000 });
    await page.waitForTimeout(1200);
    console.log('    ok');
  } catch (e) {
    console.log('    failed:', e.message.split('\n')[0]);
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
await dumpSidebar('after entering Field');

await clickLabel('Sjekklister', 'Sjekklister (expand)');
await dumpSidebar('after click Sjekklister');

await clickLabel('22. HMS', '22. HMS');
await dumpSidebar('after click 22. HMS');

await clickLabel('Til verneleder', 'Til verneleder');
await dumpSidebar('after click Til verneleder');

const shot = path.join(__dirname, '..', 'debug', 'discover2.png');
await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
console.log(`\nscreenshot: ${shot}`);

await context.close();
