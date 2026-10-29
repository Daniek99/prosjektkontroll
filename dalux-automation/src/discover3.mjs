// src/discover3.mjs
// Continue the walk: Sjekklister -> 22. HMS -> Til verneleder -> Verne- og
// miljørunde, then dump the main content (incl. colours) to find the "orange"
// list and registrations.

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

async function dumpMain(label) {
  const items = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const out = [];
    const seen = new Set();
    for (const n of all) {
      const r = n.getBoundingClientRect();
      if (!(r.left > 340 && r.width > 0 && r.height > 0 && r.top > 40 && r.top < 950)) continue;
      const t = (n.innerText || '').trim().replace(/\s+/g, ' ');
      if (!t || t.length > 55) continue;
      const childSame = Array.from(n.children).some(
        (c) => (c.innerText || '').trim().replace(/\s+/g, ' ') === t
      );
      if (childSame) continue;
      const s = getComputedStyle(n);
      const key = `${n.tagName}|${t}|${Math.round(r.top)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        tag: n.tagName.toLowerCase(),
        cls: typeof n.className === 'string' ? n.className.slice(0, 55) : '',
        t,
        y: Math.round(r.top),
        bg: s.backgroundColor,
        color: s.color,
      });
    }
    return out;
  });
  console.log(`\n===== MAIN ${label} (url: ${page.url()}) =====`);
  items.forEach((d, i) =>
    console.log(`[${i}] ${d.tag} .${d.cls} y=${d.y} bg=${d.bg} color=${d.color} "${d.t}"`)
  );
}

async function clickText(text, label) {
  const loc = page.getByText(text, { exact: false });
  const c = await loc.count();
  console.log(`\n>>> click "${label ?? text}" (${c} match${c === 1 ? '' : 'es'})`);
  if (!c) return false;
  try {
    await loc.first().scrollIntoViewIfNeeded().catch(() => {});
    await loc.first().click({ timeout: 8000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1200);
    console.log('    ok  ->', page.url());
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
await dumpMain('after Verne- og miljørunde');

await page.screenshot({ path: path.join(__dirname, '..', 'debug', 'discover3.png'), fullPage: true }).catch(() => {});
console.log('\nscreenshot: debug/discover3.png');

await context.close();
