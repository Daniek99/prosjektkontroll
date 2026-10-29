// src/discover9.mjs
// Dump the HTML/structure of one Gjør#### chip inside the checklist window to
// find how its coloured dot is rendered. Read-only.

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

// Open the first orange checklist row.
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
console.log(`orange checklist row: ${orangeRow}`);
if (!orangeRow) { await context.close(); process.exit(1); }

await page.getByText(orangeRow, { exact: true }).first().click({ timeout: 8000 });
await page.waitForTimeout(2000);

const info = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('.dialog-window *'));
  const chip = nodes.find((n) => {
    const t = (n.innerText || '').trim();
    return /^Gjør3366/.test(t) && !Array.from(n.children).some((c) => (c.innerText || '').trim() === t);
  });
  if (!chip) return { error: 'chip not found' };
  const desc = [];
  for (const n of chip.querySelectorAll('*')) {
    const s = getComputedStyle(n);
    const r = n.getBoundingClientRect();
    desc.push({
      tag: n.tagName.toLowerCase(),
      cls: (typeof n.className === 'string' ? n.className : '').slice(0, 60),
      bg: s.backgroundColor,
      border: s.borderTopColor,
      fill: s.fill,
      size: `${Math.round(r.width)}x${Math.round(r.height)}`,
    });
  }
  return {
    tag: chip.tagName.toLowerCase(),
    cls: (typeof chip.className === 'string' ? chip.className : '').slice(0, 100),
    html: chip.outerHTML.slice(0, 1500),
    descendants: desc,
  };
});

console.log('\n===== CHIP STRUCTURE =====');
console.log(JSON.stringify(info, null, 2));

await page.screenshot({ path: path.join(__dirname, '..', 'debug', 'discover9.png'), fullPage: true }).catch(() => {});
await context.close();
