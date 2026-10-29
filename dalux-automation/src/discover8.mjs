// src/discover8.mjs
// Probe ONE level deeper: open an orange checklist (HMS07-...), scroll inside
// that window, and inspect the Gjør#### task chips (dot colours). Then click
// one orange chip and dump the task window toolbar. Read-only.

import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIELD_URL =
  process.env.DALUX_FIELD_URL ||
  'https://node1.build.dalux.com/client/725256/project-dashboard/dashboard';
const USER_DATA_DIR = path.join(__dirname, '..', 'user-data');

const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: false, viewport: { width: 1600, height: 950 }, slowMo: 90,
});
const page = context.pages()[0] ?? (await context.newPage());

async function clickText(text) {
  const loc = page.getByText(text, { exact: false });
  if (!(await loc.count())) { console.log(`  !! not found: ${text}`); return; }
  await loc.first().scrollIntoViewIfNeeded().catch(() => {});
  await loc.first().click({ timeout: 8000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1100);
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

// Open the first ORANGE checklist row.
const orangeRow = await page.evaluate(() => {
  const isOrange = (c) => {
    const m = c && c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return false;
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return r >= 230 && g >= 70 && g <= 170 && b <= 70;
  };
  for (const l of document.querySelectorAll('dlx-text.dlx-underline-on-hover')) {
    let row = l;
    while (row.parentElement && row.parentElement.querySelectorAll('dlx-text.dlx-underline-on-hover').length === 1) {
      row = row.parentElement;
    }
    const dot = Array.from(row.querySelectorAll('div')).find((n) => {
      const s = getComputedStyle(n);
      const w = n.getBoundingClientRect().width;
      return w > 4 && w < 20 && (parseFloat(s.borderRadius) || 0) >= 20 && isOrange(s.backgroundColor);
    });
    if (dot) return (l.innerText || '').trim();
  }
  return null;
});
console.log(`\norange checklist row: ${orangeRow}`);
if (!orangeRow) { await context.close(); process.exit(1); }

await page.getByText(orangeRow, { exact: true }).first().click({ timeout: 8000 });
await page.waitForTimeout(1800);
console.log('checklist window open:', page.url());

// Tag the scrollable content area of the topmost dialog window.
await page.evaluate(() => {
  document.querySelectorAll('[data-purring-scroller]').forEach((e) => e.removeAttribute('data-purring-scroller'));
  const wins = document.querySelectorAll('.dialog-window');
  const win = wins[wins.length - 1];
  if (!win) return;
  for (const el of win.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    if (el.scrollHeight > el.clientHeight + 60 && /(auto|scroll)/.test(s.overflowY)) {
      el.setAttribute('data-purring-scroller', '1');
      return;
    }
  }
  win.setAttribute('data-purring-scroller', '1');
});
const scroller = page.locator('[data-purring-scroller]').first();

// Scroll inside the window, collecting Gjør#### chips + their dot colour.
const chips = new Map();
for (let i = 0; i < 120; i++) {
  const batch = await page.evaluate(() => {
    const out = [];
    const nodes = Array.from(document.querySelectorAll('.dialog-window *'));
    for (const n of nodes) {
      const t = (n.innerText || '').trim().replace(/\s+/g, ' ');
      const m = t.match(/Gjør\d+/);
      if (!m) continue;
      if (Array.from(n.children).some((c) => (c.innerText || '').trim().replace(/\s+/g, ' ') === t)) continue;
      let color = '';
      for (const d of n.querySelectorAll('div')) {
        const s = getComputedStyle(d);
        const r = d.getBoundingClientRect();
        if (r.width > 4 && r.width < 22 && (parseFloat(s.borderRadius) || 0) >= 20 &&
            s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)') { color = s.backgroundColor; break; }
      }
      out.push({ id: m[0], text: t.slice(0, 60), color });
    }
    return out;
  });
  batch.forEach((b) => chips.set(b.id, b));
  const atBottom = await scroller.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2).catch(() => true);
  if (atBottom) break;
  await scroller.evaluate((el) => { el.scrollTop += 400; }).catch(() => {});
  await page.waitForTimeout(300);
}

console.log(`\nGjør#### chips found: ${chips.size}`);
[...chips.values()].forEach((c, i) => console.log(`  ${i + 1}. ${c.id}  dot=${c.color}  "${c.text}"`));

// Click the first ORANGE chip and dump the task window toolbar.
const firstOrange = [...chips.values()].find((c) => {
  const m = c.color && c.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return false;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return r >= 230 && g >= 70 && g <= 170 && b <= 70;
});
if (firstOrange) {
  console.log(`\n>>> clicking orange chip ${firstOrange.id}`);
  const chip = page.locator('.dialog-window').last().getByText(firstOrange.id, { exact: false }).first();
  await chip.scrollIntoViewIfNeeded().catch(() => {});
  await chip.click({ timeout: 8000 }).catch((e) => console.log('   failed:', e.message.split('\n')[0]));
  await page.waitForTimeout(1800);
  console.log('windows now:', await page.locator('.dialog-window').count());
  const taskWin = page.locator('.dialog-window').last();
  const toolbar = taskWin.locator('.dialog-toolbar').last();
  const btns = await toolbar.locator('button').allInnerTexts();
  console.log('task window toolbar buttons:', JSON.stringify(btns));
}

await page.screenshot({ path: path.join(__dirname, '..', 'debug', 'discover8.png'), fullPage: true }).catch(() => {});
console.log('\nscreenshot: debug/discover8.png (read-only)');

await context.close();
