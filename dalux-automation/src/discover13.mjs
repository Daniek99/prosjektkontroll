// src/discover13.mjs
// Print dialog, step 3: select the "Håndverkerrapport" card and dump what
// appears (looking for the "Enkel" option). Does NOT press the final "Skriv ut".

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

async function dumpMatches(label, regex) {
  const data = await page.evaluate((pattern) => {
    const re = new RegExp(pattern, 'i');
    const out = [];
    for (const n of Array.from(document.querySelectorAll('.dialog-window *'))) {
      const t = (n.innerText || '').trim().replace(/\s+/g, ' ');
      if (!t || !re.test(t)) continue;
      const r = n.getBoundingClientRect();
      const s = getComputedStyle(n);
      out.push({
        tag: n.tagName.toLowerCase(),
        cls: (typeof n.className === 'string' ? n.className : '').slice(0, 70),
        text: t.slice(0, 60),
        size: `${Math.round(r.width)}x${Math.round(r.height)}`,
        x: Math.round(r.left), y: Math.round(r.top),
        cursor: s.cursor,
      });
    }
    return out;
  }, regex.source);
  console.log(`\n===== ${label} =====`);
  data.forEach((d, i) =>
    console.log(`[${i}] ${d.tag} .${d.cls} ${d.size} @(${d.x},${d.y}) cursor=${d.cursor} "${d.text}"`)
  );
  return data;
}

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
await page.waitForTimeout(2000);

const win = page.locator('.dialog-window:visible').last();
await win.locator('.dialog-toolbar').getByRole('button', { name: /^skriv ut$/i }).first().click({ timeout: 8000 })
  .catch((e) => console.log('Skriv ut failed:', e.message.split('\n')[0]));
await page.waitForTimeout(2000);

// Tick "Ta med oppgaver".
const cbWrap = page.locator('.checkbox-wrapper').filter({ hasText: 'Ta med oppgaver' }).last();
await cbWrap.locator('input[type="checkbox"]').first().check({ force: true }).catch(async () => {
  await cbWrap.locator('.checkbox, .checkbox-background').first().click();
});
await page.waitForTimeout(1000);

// Inspect the report-type cards.
const cards = await dumpMatches('report cards', /Håndverkerrapport|Enkeltrapport|Oversiktstegning|Statusrapport/);

// Click the largest element whose text is exactly "Håndverkerrapport" (the card).
const target = cards
  .filter((c) => c.text === 'Håndverkerrapport')
  .sort((a, b) => parseInt(b.size) - parseInt(a.size))[0];
console.log(`\ncard candidates for Håndverkerrapport: ${cards.filter((c) => c.text === 'Håndverkerrapport').length}`);

if (target) {
  // Re-locate it in the DOM by tag+class+text and click.
  const loc = page
    .locator(`.dialog-window ${target.tag}`)
    .filter({ hasText: /^Håndverkerrapport$/ })
    .last();
  console.log(`clicking card via ${target.tag} (matches: ${await loc.count()})`);
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await loc.click({ timeout: 8000 }).catch((e) => console.log('card click failed:', e.message.split('\n')[0]));
  await page.waitForTimeout(1500);
}

await dumpMatches('after selecting Håndverkerrapport', /Enkel|Detaljert|Håndverker/);

await page.screenshot({ path: path.join(__dirname, '..', 'debug', 'discover13.png'), fullPage: true }).catch(() => {});
console.log('\nscreenshot: debug/discover13.png (no file generated)');

await context.close();
