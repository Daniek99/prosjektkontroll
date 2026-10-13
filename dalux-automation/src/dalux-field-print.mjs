// src/dalux-field-print.mjs
//
// Automation: print the newest "Verne- og miljørunde" checklist as a
// Håndverkerrapport (Enkel) PDF and save it locally.
//
// VERIFIED FLOW (selectors captured from the live app):
//   Dashboard -> Field -> Sjekklister -> 22. HMS -> Til verneleder
//     -> Verne- og miljørunde   (form list — a VIRTUAL grid, newest first)
//   1. Open the NEWEST checklist (first row).
//   2. "Skriv ut" in the checklist window toolbar -> the print dialog opens.
//   3. Tick "Ta med oppgaver".
//   4. Click the "Håndverkerrapport" card (dlx-field-print-button).
//   5. Tick "Enkel"  (data-cy="checkbox-component-Enkel").
//   6. "Skriv ut" -> the report is generated -> "Åpne" -> the PDF downloads.
//   7. Save it as  Vernerunde uke <ISO week> <year>.pdf  in the HMS15 folder.
//
// Run:
//   npm run dalux:print
//   DRY_RUN=1 npm run dalux:print     # stops before generating the file
//   DUMP=1 npm run dalux:print        # save screenshots + HTML to ./debug
//
// Only use against an account you are authorised to access, within Dalux's ToS.

import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const FIELD_URL =
  process.env.DALUX_FIELD_URL ||
  'https://node1.build.dalux.com/client/725256/project-dashboard/dashboard';

const USER_DATA_DIR = path.join(__dirname, '..', 'user-data');
const DEBUG_DIR = path.join(__dirname, '..', 'debug');

const LBL_CHECKLISTS = 'Sjekklister';
const LBL_PACKAGE = '22. HMS';
const LBL_WORKFLOW = 'Til verneleder';
const LBL_FORM = 'Verne- og miljørunde';

// Where the PDF is saved.
const SAVE_DIR =
  process.env.PRINT_SAVE_DIR ||
  'C:\\Users\\NO-daek\\Veidekke\\OBOS - Hammersborg torg - General\\HMS\\HMS15 Verneprotokoll';
const FILE_PREFIX = 'Vernerunde uke';

const DRY_RUN = process.env.DRY_RUN === '1';
const HEADLESS = process.env.HEADLESS === '1';
const SLOW_MO = Number(process.env.SLOW_MO || 200);
const DUMP = process.env.DUMP === '1';
const SCROLL_STEP = Number(process.env.SCROLL_STEP || 500);
// ──────────────────────────────────────────────────────────────────────────────

const log = (...a) => console.log('  ', ...a);
const WINDOWS = '.dialog-window:visible'; // Dalux keeps closed dialogs in the DOM
const openWindows = (page) => page.locator(WINDOWS);

/** ISO-8601 week number, e.g. 2026-10-12 -> { week: 42, year: 2026 }. */
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

async function dump(page, name) {
  if (!DUMP) return;
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    await page.screenshot({ path: path.join(DEBUG_DIR, `${name}.png`), fullPage: true });
    fs.writeFileSync(path.join(DEBUG_DIR, `${name}.html`), await page.content());
    log(`dump: ${name}`);
  } catch (e) {
    log(`dump failed (${name}): ${e.message}`);
  }
}

async function isVisible(page, text) {
  const loc = page.getByText(text, { exact: false });
  if ((await loc.count()) === 0) return false;
  return await loc.first().isVisible().catch(() => false);
}

async function clickText(page, text, { exact = false, timeout = 15000 } = {}) {
  const loc = page.getByText(text, { exact });
  await loc.first().waitFor({ state: 'visible', timeout });
  await loc.first().scrollIntoViewIfNeeded().catch(() => {});
  await loc.first().click({ timeout: 8000 });
  log(`clicked "${text}"`);
}

/** Close stacked modals until only `keep` windows remain. */
async function closeTopWindow(page, keep = 1) {
  for (let i = 0; i < 6; i++) {
    if ((await openWindows(page).count()) <= keep) return;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(450);
    if ((await openWindows(page).count()) <= keep) return;
    await openWindows(page).last().locator('button.icon-btn').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(450);
  }
}

async function enterField(page) {
  const lukk = page.getByRole('button', { name: /^lukk$/i });
  if (await lukk.count()) { await lukk.first().click().catch(() => {}); await page.waitForTimeout(400); }
  await page.getByRole('button', { name: /^field/i }).first().click({ timeout: 8000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByText(LBL_CHECKLISTS, { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(800);
}

async function openChecklist(page) {
  if (!(await isVisible(page, 'Alle sjekklister'))) {
    await clickText(page, LBL_CHECKLISTS);
    await page.waitForTimeout(600);
  }
  await clickText(page, LBL_PACKAGE);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByText(LBL_WORKFLOW, { exact: false }).first().waitFor({ state: 'visible', timeout: 20000 });
  await clickText(page, LBL_WORKFLOW);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByText(LBL_FORM, { exact: false }).first().waitFor({ state: 'visible', timeout: 20000 });
  await clickText(page, LBL_FORM);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('dlx-text.dlx-underline-on-hover').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(600);
}

/** Tag the scrollable virtual grid on the list page. */
async function tagGridScroller(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-purring-scroller]').forEach((e) => e.removeAttribute('data-purring-scroller'));
    const links = document.querySelectorAll('dlx-text.dlx-underline-on-hover');
    if (!links.length) {
      (document.scrollingElement || document.body).setAttribute('data-purring-scroller', '1');
      return;
    }
    let el = links[0];
    while (el && el !== document.body) {
      const s = getComputedStyle(el);
      if (el.scrollHeight > el.clientHeight + 20 && /(auto|scroll)/.test(s.overflowY)) {
        el.setAttribute('data-purring-scroller', '1');
        return;
      }
      el = el.parentElement;
    }
    (document.scrollingElement || document.body).setAttribute('data-purring-scroller', '1');
  });
  return page.locator('[data-purring-scroller]').first();
}

const atBottom = (scroller) => scroller.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
const scrollDown = (scroller, step) => scroller.evaluate((el, s) => { el.scrollTop += s; }, step);
const scrollTop = (scroller) => scroller.evaluate((el) => { el.scrollTop = 0; });

/** The newest checklist = the first Nr link after scrolling the grid to the top. */
async function openNewestChecklist(page, scroller) {
  await scrollTop(scroller);
  await page.waitForTimeout(500);
  const nr = await page.evaluate(() => {
    const l = document.querySelector('dlx-text.dlx-underline-on-hover');
    return l ? (l.innerText || '').trim() : null;
  });
  if (!nr) throw new Error('no checklist rows rendered');
  log(`newest checklist: ${nr}`);
  await page.getByText(nr, { exact: true }).first().click({ timeout: 8000 });
  const win = openWindows(page).last();
  await win.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(900);
  return nr;
}

/** Tick a checkbox in the print dialog by its label text. */
async function tickPrintOption(page, label) {
  const wrap = page.locator('.checkbox-wrapper').filter({ hasText: label }).last();
  if (!(await wrap.count())) throw new Error(`checkbox "${label}" not found`);
  const input = wrap.locator('input[type="checkbox"]').first();
  const already = await input.evaluate((el) => el.checked).catch(() => false);
  if (!already) {
    await input.check({ force: true }).catch(async () => {
      await wrap.locator('.checkbox, .checkbox-background').first().click();
    });
  }
  log(`ticked "${label}"`);
}

async function main() {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: HEADLESS,
    viewport: { width: 1600, height: 950 },
    slowMo: SLOW_MO,
  });
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto(FIELD_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  if (/login|signin|auth/i.test(page.url())) {
    console.warn('\nRedirected to a login page. Run `npm run login` first.\n');
    await context.close();
    process.exitCode = 1;
    return;
  }

  await enterField(page);
  await openChecklist(page);

  const scroller = await tagGridScroller(page);
  const nr = await openNewestChecklist(page, scroller);
  await dump(page, '01-checklist-open');

  // ── Print dialog ────────────────────────────────────────────────────────────
  const win = openWindows(page).last();
  await win.locator('.dialog-toolbar').getByRole('button', { name: /^skriv ut$/i }).first().click({ timeout: 8000 });
  await page.waitForTimeout(2000);
  log('print dialog open');

  await tickPrintOption(page, 'Ta med oppgaver');
  await page.waitForTimeout(800);

  // Select the Håndverkerrapport card.
  const card = page.locator('dlx-field-print-button').filter({ hasText: 'Håndverkerrapport' }).first();
  if (!(await card.count())) throw new Error('Håndverkerrapport card not found');
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await card.click({ timeout: 8000 });
  await page.waitForTimeout(1200);
  log('selected Håndverkerrapport');

  // Tick "Enkel" inside that card.
  const enkel = page.locator('[data-cy="checkbox-component-Enkel"] input[type="checkbox"]').first();
  if (!(await enkel.count())) throw new Error('"Enkel" checkbox not found');
  await enkel.check({ force: true }).catch(async () => {
    await page.locator('[data-cy="checkbox-component-Enkel"]').first().locator('.checkbox, .checkbox-background').first().click();
  });
  log('ticked "Enkel"');
  await dump(page, '02-print-dialog');

  if (DRY_RUN) {
    log('DRY_RUN: not generating the file (cancelling)');
    await openWindows(page).last().getByRole('button', { name: /avbryt/i }).first().click().catch(() => {});
    await closeTopWindow(page, 0);
    await context.close();
    return;
  }

  // ── Generate + save ─────────────────────────────────────────────────────────
  fs.mkdirSync(SAVE_DIR, { recursive: true });
  const { week, year } = isoWeek(new Date());
  const fileName = `${FILE_PREFIX} ${week} ${year}.pdf`;
  const target = path.join(SAVE_DIR, fileName);

  const downloadPromise = page.waitForEvent('download', { timeout: 120000 }).catch(() => null);
  const popupPromise = page.waitForEvent('popup', { timeout: 120000 }).catch(() => null);

  await openWindows(page).last().getByRole('button', { name: /^skriv ut$/i }).first().click({ timeout: 8000 });
  log('generating report…');

  // Wait for the file to be ready, then press "Åpne".
  const openBtn = page.getByRole('button', { name: /^åpne$/i }).first();
  await openBtn.waitFor({ state: 'visible', timeout: 180000 });
  log('file ready — pressing "Åpne"');
  await openBtn.click({ timeout: 8000 });

  const download = await downloadPromise;
  if (download) {
    await download.saveAs(target);
    log(`saved: ${target}`);
  } else {
    // The PDF may open in a new tab instead of triggering a download.
    const popup = await popupPromise;
    if (!popup) throw new Error('neither a download nor a new tab appeared');
    const response = await popup
      .waitForResponse((r) => (r.headers()['content-type'] || '').includes('pdf'), { timeout: 30000 })
      .catch(() => null);
    if (response) {
      fs.writeFileSync(target, await response.body());
    } else {
      const res = await page.request.get(popup.url());
      fs.writeFileSync(target, await res.body());
    }
    await popup.close().catch(() => {});
    log(`saved from new tab: ${target}`);
  }

  await closeTopWindow(page, 0);
  console.log(`\nDone. Saved "${fileName}" to ${SAVE_DIR}\n`);
  await context.close();
}

await main();
