// src/dalux-field-purring.mjs
//
// Automation: send a "Purring" (reminder) for ORANGE tasks inside an ORANGE
// checklist in Dalux Field.
//
// VERIFIED FLOW (selectors captured from the live app):
//   Dashboard -> Field -> Sjekklister -> 22. HMS -> Til verneleder
//     -> Verne- og miljørunde   (opens the form list — a VIRTUAL grid)
//   Level 1 — checklist rows (<tr>, 12x12 status dot):
//       orange rgb(255,102,0) "Påbegynt" = unfinished  <- we enter these
//       green  rgb(36,160,91) "Avsluttet" = done       (ignored)
//   Level 2 — inside the checklist window (div.dialog-window), the attached
//   tasks are chips with data-cy="attached-tasks-chip"; the dot is
//   dlx-icon.icon-status-ongoing -> i.mask-icon (bg = the status colour):
//       orange = unfinished task  <- we act on these
//       green/yellow = ignored
//   For each ORANGE task chip:
//     click it -> the task window opens (a second .dialog-window on top,
//     toolbar: Godkjenn / Tildel / Lenke til / Skriv ut / Mer)
//       -> "Mer" -> "Notifiser"
//       -> "Beskjed" dialog: search "Daniel Ekman", tick the checkbox,
//          type "Purring" in the message, Send
//     -> close the task window, continue with the next orange chip.
//
// NOTE: Dalux keeps closed dialogs in the DOM (hidden), so window counting
// always uses `.dialog-window:visible`.
//
// Run:
//   npm run dalux:purring                 # headed, asks for confirmation
//   DRY_RUN=1 npm run dalux:purring       # rehearse: fills the form, does NOT Send
//   DUMP=1 npm run dalux:purring          # save screenshots + HTML to ./debug
//
// This sends real notifications to a real person. Only use it against an
// account you are authorised to access, within Dalux's terms of service.

import { chromium } from '@playwright/test';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
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

const NOTIFY_PERSON = 'Daniel Ekman';
const MESSAGE = 'Purring';

const DRY_RUN = process.env.DRY_RUN === '1';
const HEADLESS = process.env.HEADLESS === '1';
const AUTO = process.env.AUTO === '1'; // scheduled run: skip the confirmation prompt
const SLOW_MO = Number(process.env.SLOW_MO || 200);
const MAX_ITEMS = Number(process.env.MAX_ITEMS || 50);
const DUMP = process.env.DUMP === '1';
const SCROLL_STEP = Number(process.env.SCROLL_STEP || 500);
// ──────────────────────────────────────────────────────────────────────────────

const log = (...a) => console.log('  ', ...a);
const WINDOWS = '.dialog-window:visible'; // only actually-open windows
const openWindows = (page) => page.locator(WINDOWS);

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

/**
 * Close stacked modals until only `keep` windows remain.
 * Tries Escape first, then the topmost window's X button.
 */
async function closeTopWindow(page, keep = 1) {
  for (let i = 0; i < 6; i++) {
    if ((await openWindows(page).count()) <= keep) return;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(450);
    if ((await openWindows(page).count()) <= keep) return;
    await openWindows(page)
      .last()
      .locator('button.icon-btn')
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
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

/** Tag the scrollable container of the topmost dialog window. */
async function tagWindowScroller(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-purring-scroller]').forEach((e) => e.removeAttribute('data-purring-scroller'));
    const wins = Array.from(document.querySelectorAll('.dialog-window')).filter((w) => {
      const s = getComputedStyle(w);
      return s.display !== 'none' && s.visibility !== 'hidden' && w.getBoundingClientRect().width > 0;
    });
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
  return page.locator('[data-purring-scroller]').first();
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

/** Level 1: rendered checklist rows whose status dot is ORANGE. */
async function getOrangeChecklistRows(page) {
  return await page.evaluate(() => {
    const isOrange = (color) => {
      const m = color && color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return false;
      const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
      return r >= 230 && g >= 70 && g <= 170 && b <= 70; // ≈ #FF6600
    };
    const links = Array.from(document.querySelectorAll('dlx-text.dlx-underline-on-hover'));
    const res = [];
    for (const l of links) {
      let row = l;
      while (row.parentElement && row.parentElement.querySelectorAll('dlx-text.dlx-underline-on-hover').length === 1) {
        row = row.parentElement;
      }
      const dot = Array.from(row.querySelectorAll('div')).find((n) => {
        const s = getComputedStyle(n);
        const w = n.getBoundingClientRect().width;
        const radius = parseFloat(s.borderRadius) || 0;
        return w > 4 && w < 20 && radius >= 20 && isOrange(s.backgroundColor);
      });
      if (!dot) continue;
      const nr = (l.innerText || '').trim();
      const sm = (row.innerText || '').match(/Påbegynt|Forfalt|Åpnet|Ikke startet|Utkast|Avsluttet/i);
      if (nr) res.push({ nr, status: sm ? sm[0] : '' });
    }
    return res;
  });
}

/** Scroll the virtual grid, collecting every orange checklist row (deduped). */
async function scanOrangeChecklists(page, scroller) {
  const found = new Map();
  await scrollTop(scroller);
  await page.waitForTimeout(400);
  for (let i = 0; i < 400; i++) {
    (await getOrangeChecklistRows(page)).forEach((b) => found.set(b.nr, b));
    if (await atBottom(scroller)) break;
    await scrollDown(scroller, SCROLL_STEP);
    await page.waitForTimeout(250);
  }
  (await getOrangeChecklistRows(page)).forEach((b) => found.set(b.nr, b));
  return [...found.values()];
}

/** Scroll the grid until the given checklist Nr is rendered, then click it. */
async function openChecklistRow(page, scroller, nr) {
  await scrollTop(scroller);
  await page.waitForTimeout(300);
  for (let i = 0; i < 400; i++) {
    const loc = page.getByText(nr, { exact: true });
    if (await loc.count()) {
      await loc.first().scrollIntoViewIfNeeded().catch(() => {});
      await loc.first().click({ timeout: 8000 });
      return;
    }
    if (await atBottom(scroller)) break;
    await scrollDown(scroller, SCROLL_STEP);
    await page.waitForTimeout(250);
  }
  throw new Error(`could not find checklist row ${nr}`);
}

/** Level 2: task chips (data-cy="attached-tasks-chip") with an ORANGE dot. */
async function getOrangeChips(page) {
  return await page.evaluate(() => {
    const isOrange = (color) => {
      const m = color && color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return false;
      const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
      return r >= 230 && g >= 70 && g <= 170 && b <= 70;
    };
    const chips = Array.from(document.querySelectorAll('[data-cy="attached-tasks-chip"]'));
    const out = [];
    for (const c of chips) {
      const icon = c.querySelector('dlx-icon');
      const statusClass = icon ? icon.getAttribute('class') || '' : '';
      const mask = c.querySelector('i.mask-icon');
      const bg = mask ? getComputedStyle(mask).backgroundColor : '';
      if (!(/ongoing/i.test(statusClass) || isOrange(bg))) continue;
      const text = (c.innerText || '').trim().replace(/\s+/g, ' ');
      const id = (text.match(/Gjør\d+/) || [])[0] || text.slice(0, 24);
      out.push({ id, text: text.slice(0, 60), statusClass: statusClass.trim(), bg });
    }
    return out;
  });
}

/** Scroll inside the checklist window, collecting every orange task chip. */
async function collectOrangeChips(page) {
  const scroller = await tagWindowScroller(page);
  const found = new Map();
  for (let i = 0; i < 80; i++) {
    (await getOrangeChips(page)).forEach((c) => found.set(c.id, c));
    const bottom = await atBottom(scroller).catch(() => true);
    if (bottom) break;
    await scrollDown(scroller, 400).catch(() => {});
    await page.waitForTimeout(250);
  }
  (await getOrangeChips(page)).forEach((c) => found.set(c.id, c));
  return [...found.values()];
}

/** With the task window open: Mer -> Notifiser -> Beskjed -> (Send). */
async function notifyOpenTaskWindow(page, id) {
  const win = openWindows(page).last();
  await win.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(600);

  await win.locator('.dialog-toolbar').getByRole('button', { name: /^mer$/i }).first().click({ timeout: 8000 });
  await page.waitForTimeout(600);
  await page.getByText('Notifiser', { exact: true }).first().click({ timeout: 8000 });

  const notify = openWindows(page).last();
  await notify.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(600);

  await notify.locator('input[type="text"]').first().fill(NOTIFY_PERSON);
  await page.waitForTimeout(700);
  const personRow = notify
    .locator(`xpath=.//*[normalize-space(text())="${NOTIFY_PERSON}"]/ancestor::*[.//input[@type="checkbox"]][1]`)
    .first();
  const hasRow = (await personRow.count()) > 0;
  const cb = hasRow
    ? personRow.locator('input[type="checkbox"]').first()
    : notify.locator('input[type="checkbox"]').nth(1);
  await cb.check({ force: true }).catch(async () => {
    await (hasRow ? personRow : notify).locator('.checkbox, .checkbox-wrapper, .checkbox-background').first().click();
  });
  log(`  selected ${NOTIFY_PERSON}${hasRow ? '' : ' (fallback)'}`);

  await notify.locator('textarea').first().fill(MESSAGE);
  await page.waitForTimeout(300);
  log(`  message: ${MESSAGE}`);
  await dump(page, `02-beskjed-${id}`);

  if (DRY_RUN) {
    log('  DRY_RUN: not sending (cancelling)');
    await notify.getByRole('button', { name: /avbryt/i }).first().click().catch(() => {});
  } else {
    const send = notify.getByRole('button', { name: /^send$/i }).first();
    await send.waitFor({ state: 'visible', timeout: 8000 });
    await send.click();
    log('  sent');
    await page.waitForTimeout(900);
  }

  await closeTopWindow(page, 1); // close the task window, back to the checklist
}

/** Open one orange checklist and send reminders for each orange task in it. */
async function processChecklist(page, scroller, nr) {
  log(`checklist ${nr}`);
  await openChecklistRow(page, scroller, nr);
  const win = openWindows(page).last();
  await win.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(900);

  const chips = await collectOrangeChips(page);
  log(`  ${chips.length} orange task(s) inside`);
  await dump(page, `03-checklist-${nr}`);

  let processed = 0;
  for (const chip of chips.slice(0, MAX_ITEMS)) {
    log(`  → task ${chip.id} "${chip.text}"`);
    try {
      const chipLoc = page.locator('[data-cy="attached-tasks-chip"]').filter({ hasText: chip.id }).first();
      await chipLoc.scrollIntoViewIfNeeded().catch(() => {});
      await chipLoc.click({ timeout: 8000 });
      await notifyOpenTaskWindow(page, chip.id);
      processed++;
    } catch (e) {
      console.error(`    failed on ${chip.id}: ${e.message.split('\n')[0]}`);
      await dump(page, `error-${chip.id}`);
      await closeTopWindow(page, 1);
    }
  }

  await closeTopWindow(page, 0); // close the checklist window
  return processed;
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
  await dump(page, '01-checklist');

  const scroller = await tagGridScroller(page);
  const orange = await scanOrangeChecklists(page, scroller);

  console.log(`\nFound ${orange.length} ORANGE checklist(s):`);
  orange.forEach((u, i) => console.log(`  ${i + 1}. ${u.nr}  [${u.status}]`));

  if (!orange.length) {
    await context.close();
    return;
  }

  if (!DRY_RUN && !AUTO) {
    const rl = readline.createInterface({ input, output });
    const ans = await rl.question(
      `\nSend "${MESSAGE}" to ${NOTIFY_PERSON} for every orange task in these checklists? [y/N] `
    );
    rl.close();
    if (!/^y$/i.test(ans.trim())) {
      console.log('Aborted.');
      await context.close();
      return;
    }
  }

  let total = 0;
  for (const item of orange.slice(0, MAX_ITEMS)) {
    try {
      total += await processChecklist(page, scroller, item.nr);
    } catch (e) {
      console.error(`  failed on checklist ${item.nr}: ${e.message.split('\n')[0]}`);
      await closeTopWindow(page, 0);
    }
  }

  console.log(`\nDone. Sent ${total} reminder(s)${DRY_RUN ? ' (DRY RUN)' : ''}.\n`);
  await context.close();
}

await main();
