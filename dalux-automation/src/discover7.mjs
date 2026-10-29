// src/discover7.mjs
// Probe one row's structure to find the coloured status dot: climb to the real
// row, then list coloured / dot-like descendants.

import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIELD_URL =
  process.env.DALUX_FIELD_URL ||
  'https://node1.build.dalux.com/client/725256/project-dashboard/dashboard';
const USER_DATA_DIR = path.join(__dirname, '..', 'user-data');

const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: false, viewport: { width: 1600, height: 950 }, slowMo: 80,
});
const page = context.pages()[0] ?? (await context.newPage());

async function clickText(text) {
  const loc = page.getByText(text, { exact: false });
  if (!(await loc.count())) { console.log(`  !! not found: ${text}`); return; }
  await loc.first().scrollIntoViewIfNeeded().catch(() => {});
  await loc.first().click({ timeout: 8000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
}

await page.goto(FIELD_URL, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(2000);
const lukk = page.getByRole('button', { name: /^lukk$/i });
if (await lukk.count()) { await lukk.first().click().catch(() => {}); await page.waitForTimeout(400); }
await page.getByRole('button', { name: /^field/i }).first().click({ timeout: 8000 }).catch(() => {});
await page.getByText('Sjekklister', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1200);

await clickText('Sjekklister');
await clickText('22. HMS');
await clickText('Til verneleder');
await clickText('Verne- og miljørunde');
await page.locator('dlx-text.dlx-underline-on-hover').first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
await page.waitForTimeout(800);

const report = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('dlx-text.dlx-underline-on-hover'));
  const out = [];
  for (const l of links.slice(0, 4)) {
    // Climb to the real row: the highest ancestor that still holds exactly 1 nr link.
    let row = l;
    while (row.parentElement && row.parentElement.querySelectorAll('dlx-text.dlx-underline-on-hover').length === 1) {
      row = row.parentElement;
    }
    const nr = (l.innerText || '').trim();
    const rowText = (row.innerText || '').replace(/\s+/g, ' ').slice(0, 90);

    const colored = [];
    for (const n of row.querySelectorAll('*')) {
      const r = n.getBoundingClientRect();
      const s = getComputedStyle(n);
      const cls = typeof n.className === 'string' ? n.className : '';
      const bg = s.backgroundColor;
      const interesting =
        (bg && bg !== 'rgba(0, 0, 0, 0)') ||
        n.tagName.toLowerCase() === 'svg' ||
        n.tagName.toLowerCase() === 'circle' ||
        /dot|status|indicator|color|circle|bullet/i.test(cls);
      if (!interesting) continue;
      colored.push({
        tag: n.tagName.toLowerCase(),
        cls: cls.slice(0, 50),
        bg: bg,
        fill: s.fill,
        w: Math.round(r.width), h: Math.round(r.height),
        radius: s.borderRadius,
      });
    }

    const childTags = Array.from(row.children).map(
      (c) => `${c.tagName.toLowerCase()}.${(typeof c.className === 'string' ? c.className : '').split(' ')[0]}`
    );
    out.push({ nr, rowText, childTags, colored });
  }
  return out;
});

for (const r of report) {
  console.log(`\n===== ${r.nr} =====`);
  console.log(`rowText: "${r.rowText}"`);
  console.log(`children: ${r.childTags.join(' | ')}`);
  console.log(`coloured/dot-like descendants (${r.colored.length}):`);
  r.colored.forEach((c) =>
    console.log(`   ${c.tag} .${c.cls} bg=${c.bg} fill=${c.fill} ${c.w}x${c.h} r=${c.radius}`)
  );
}

const shot = path.join(__dirname, '..', 'debug', 'discover7.png');
await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
console.log(`\nscreenshot: ${shot}`);

await context.close();
