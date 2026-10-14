// src/dalux-field-print.mjs
//
// Automation: print the newest "Verne- og miljørunde" checklist as a
// Håndverkerrapport (Enkel) PDF, save it locally — and draft the follow-up
// email for the round.
//
// VERIFIED FLOW (selectors captured from the live app):
//   Dashboard -> Field -> Sjekklister -> 22. HMS -> Til verneleder
//     -> Verne- og miljørunde   (form list — a VIRTUAL grid, newest first)
//   1. Open the NEWEST checklist (first row).
//   2. "Skriv ut" in the checklist window toolbar -> the print dialog opens.
//   3. Tick "Ta med oppgaver".
//   4. Click the "Håndverkerrapport" card (dlx-field-print-button).
//   5. Tick "Enkel"  (data-cy="checkbox-component-Enkel").
//   6. "Skriv ut" -> the report is generated -> "Åpne" (data-cy
//      "progress-open-btn"; present but DISABLED while generating) -> download.
//   7. Save it as  Vernerunde uke <ISO week> <year>.pdf  in the HMS15 folder.
//
// EMAIL DRAFT (same automation, after the PDF is saved):
//   - Content is extracted from the checklist window: the key/value answer
//     rows (grades, weather, next round) and the "Generelt:" note.
//   - Recipients: every contact in the "Vernerunde" category (Supabase
//     `contacts` table).
//   - A standards-compliant draft .eml (From / To / subject / body + the PDF
//     attached) is written next to the PDF and opened in the default mail
//     client (Outlook) for review — nothing is sent automatically.
//
// Run:
//   npm run dalux:print
//   DRY_RUN=1 npm run dalux:print     # stops before generating the file
//   DUMP=1 npm run dalux:print        # save screenshots + HTML to ./debug
//
// Only use against an account you are authorised to access, within Dalux's ToS.

import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load credentials: the app's .env.local (one level up) and any local .env here.
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

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

// Email draft settings.
const EMAIL_FROM = process.env.EMAIL_FROM || 'daniel.ekman@veidekke.no';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Daniel Ekman';
const EMAIL_CATEGORY = process.env.EMAIL_CATEGORY || 'Vernerunde';
const EMAIL_PROJECT = process.env.EMAIL_PROJECT || 'Hammersborg Torg';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_KEY =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

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

// ── Email draft ───────────────────────────────────────────────────────────────

/** Key/value answers + free text from the (still open) checklist window. */
async function extractReport(page) {
  return await page.evaluate(() => {
    const wins = Array.from(document.querySelectorAll('.dialog-window')).filter((w) => {
      const r = w.getBoundingClientRect();
      return r.width > 0 && w.querySelector('dlx-field-report-two-columns');
    });
    const win = wins[0];
    if (!win) return { kv: {}, generelt: '', weather: '' };
    const kv = {};
    // Report item rows: [data-cy="report-item-N"] -> .keyColumn label +
    // [data-cy="checklist-report-item-value"] value (grades, weather, etc.).
    for (const row of win.querySelectorAll('[data-cy^="report-item-"]')) {
      const label = row.querySelector('.keyColumn .reportComment');
      const value = row.querySelector('[data-cy="checklist-report-item-value"]');
      if (!label || !value) continue;
      const key = (label.innerText || '').trim().replace(/\s+/g, ' ');
      const val = (value.innerText || '').trim().replace(/\s+/g, ' ');
      if (key && val) kv[key] = val;
    }
    const texts = Array.from(win.querySelectorAll('.selectable-text'))
      .map((n) => (n.innerText || '').trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    const generelt = texts.find((t) => /^Generelt:/i.test(t)) || '';
    const weather = kv['Værforhold'] || texts.find((t) => /°C|fuktighet/i.test(t)) || '';
    return { kv, generelt, weather };
  });
}

/**
 * Compose the email body: greeting + overall grades, then ONLY the keywords
 * from the main text field. The per-area section (names + grades), the
 * "Tilbake" date, weather and next-round time are all left out.
 */
function buildEmailBody(report, week, year) {
  const num = (v) => (String(v ?? '').match(/\d+/) || ['?'])[0];
  const ryddighet = num(report.kv['Deltakers vurdering av ryddighet (1-7)']);
  const sikkerhet = num(report.kv['Deltakers vurdering av sikkerhet (1-7)']);

  let note = (report.generelt || '').replace(/^Generelt:\s*/i, '').trim();
  // Drop the per-area section: everything from "Områder:" up to (not incl.)
  // "Tilbake" or "Fokus på:".
  note = note.replace(/\s*Områder:[\s\S]*?(?=\s*(?:Tilbake\s|Fokus på:))/i, '\n\n');
  // Drop the "Tilbake <date>" marker.
  note = note.replace(/\s*Tilbake\s+\S+\s*/i, '\n\n');
  // Break the remaining markers onto their own lines.
  note = note
    .replace(/\s*Fokus på:\s*/i, '\n\nFokus fremover:\n')
    .replace(/\s*Til HMSkvarter:\s*/i, '\n\nTil HMSkvarter:\n')
    .trim();

  const lines = [
    'Hei,',
    '',
    `Se vedlagt referat fra ukens vernerunde (${EMAIL_PROJECT}, uke ${week} ${year}).`,
    'Karakterer for ryddighet og sikkerhet er satt som følger:',
    '',
    `Ryddighet: ${ryddighet}/7`,
    `Sikkerhet: ${sikkerhet}/7`,
  ];
  if (note) lines.push('', note);
  lines.push('', 'Mvh', EMAIL_FROM_NAME, 'Veidekke Entreprenør AS');
  return lines.join('\n');
}

/** Recipients: all contacts in the given category (Supabase `contacts`). */
async function getRecipients() {
  if (!SUPABASE_URL || !(SERVICE_KEY || ANON_KEY)) {
    throw new Error('missing Supabase credentials for the contacts lookup');
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY || ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase
    .from('contacts')
    .select('name,email')
    .eq('category', EMAIL_CATEGORY)
    .order('name');
  if (error) throw new Error(`contacts: ${error.message}`);
  return (data || []).filter((c) => (c.email || '').trim());
}

/** Write a standards-compliant .eml (text + PDF attachment) with CRLF endings. */
function writeEml({ from, fromName, to, subject, body, pdfPath, outPath }) {
  const boundary = '----=_VernerundeDraft';
  const b64 = (buf) => buf.toString('base64').replace(/(.{76})/g, '$1\r\n');
  const pdfBuf = fs.readFileSync(pdfPath);
  const pdfName = path.basename(pdfPath);
  const lines = [
    `From: ${fromName} <${from}>`,
    `To: ${to.join(',\r\n ')}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(Buffer.from(body, 'utf8')),
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfName}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${pdfName}"`,
    '',
    b64(pdfBuf),
    `--${boundary}--`,
    '',
  ];
  fs.writeFileSync(outPath, lines.join('\r\n'), 'binary');
}

/**
 * Write a file, retrying while Windows reports EBUSY/EPERM — happens when the
 * PDF is open in a viewer (Acrobat/Edge lock files). Waits up to ~5 minutes.
 */
async function writeFileWithRetry(buf, target, page) {
  for (let i = 0; ; i++) {
    try {
      fs.writeFileSync(target, buf);
      return;
    } catch (e) {
      if (!['EBUSY', 'EPERM'].includes(e.code) || i >= 60) {
        throw new Error(
          `could not write "${target}" — ${e.code || e.message}. ` +
            'Close the PDF in any viewer and run again.'
        );
      }
      if (i === 0) log('file locked (open in a viewer?) — retrying…');
      await page.waitForTimeout(5000);
    }
  }
}

/**
 * Create a draft in the local Outlook profile's Drafts folder (never sent) via
 * COM automation. Throws if Outlook isn't available.
 */
function createOutlookDraft({ to, subject, body, attachment }) {
  const tmpJson = path.join(DEBUG_DIR, 'outlook-draft.json');
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  fs.writeFileSync(tmpJson, JSON.stringify({ to, subject, body, attachment }, null, 2), 'utf8');
  const ps1 = path.join(__dirname, '..', 'scripts', 'outlook-draft.ps1');
  const res = spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, tmpJson],
    { encoding: 'utf8' }
  );
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  if (res.status !== 0 || !/DRAFT_SAVED/.test(out)) {
    throw new Error((out.trim().split('\n').pop() || 'powershell failed').slice(0, 200));
  }
}

/** Draft the email: extract content, gather recipients, save as an Outlook draft. */
async function createEmailDraft(page, pdfPath, { week, year }) {
  const report = await extractReport(page);
  log('extracted report content');

  const recipients = await getRecipients();
  if (!recipients.length) throw new Error(`no recipients in category "${EMAIL_CATEGORY}"`);
  log(`recipients: ${recipients.length} (category "${EMAIL_CATEGORY}")`);

  const subject = `${FILE_PREFIX} ${week} ${year} - ${EMAIL_PROJECT}`;
  const body = buildEmailBody(report, week, year);
  const to = recipients.map((r) => r.email.trim());

  // Preferred: a real draft in the Outlook Drafts folder (never sent).
  try {
    createOutlookDraft({ to, subject, body, attachment: pdfPath });
    log('saved as a draft in Outlook (Drafts folder) — not sent');
    return { kind: 'outlook', path: null };
  } catch (e) {
    log(`Outlook draft unavailable (${e.message}) — writing a .eml instead`);
  }

  // Fallback: a .eml file next to the PDF (not opened automatically).
  const outPath = path.join(SAVE_DIR, `${FILE_PREFIX} ${week} ${year} - epost.eml`);
  writeEml({ from: EMAIL_FROM, fromName: EMAIL_FROM_NAME, to, subject, body, pdfPath, outPath });
  log(`email draft written: ${outPath}`);
  return { kind: 'eml', path: outPath };
}

// ── Main ──────────────────────────────────────────────────────────────────────

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

  // Wait for the file to be ready, then press "Åpne". The button (data-cy
  // "progress-open-btn") is present but DISABLED while the report generates —
  // click() keeps retrying until it becomes enabled.
  const openBtn = page.locator('[data-cy="progress-open-btn"]').first();
  await openBtn.waitFor({ state: 'visible', timeout: 180000 });
  log('file ready — waiting for the report to finish generating…');
  await openBtn.click({ timeout: 180000 });
  log('pressed "Åpne"');

  const download = await downloadPromise;
  if (download) {
    for (let i = 0; ; i++) {
      try {
        await download.saveAs(target);
        break;
      } catch (e) {
        if (!['EBUSY', 'EPERM'].includes(e.code) || i >= 12) throw e;
        if (i === 0) log('file locked (open in a viewer?) — retrying…');
        await page.waitForTimeout(5000);
      }
    }
    log(`saved: ${target}`);
  } else {
    // The PDF may open in a new tab instead of triggering a download.
    const popup = await popupPromise;
    if (!popup) throw new Error('neither a download nor a new tab appeared');
    const response = await popup
      .waitForResponse((r) => (r.headers()['content-type'] || '').includes('pdf'), { timeout: 30000 })
      .catch(() => null);
    const body = response
      ? await response.body()
      : await (await page.request.get(popup.url())).body();
    await popup.close().catch(() => {});
    await writeFileWithRetry(body, target, page);
    log(`saved from new tab: ${target}`);
  }

  // ── Email draft (same automation) ───────────────────────────────────────────
  // The checklist window is still open here, so its content can be extracted.
  let draft = null;
  try {
    draft = await createEmailDraft(page, target, { week, year });
  } catch (e) {
    console.error(`  email draft failed: ${e.message.split('\n')[0]}`);
  }

  await closeTopWindow(page, 0);
  const draftMsg = draft
    ? draft.kind === 'outlook'
      ? '\nEmail draft: saved in Outlook → Drafts (not sent)'
      : `\nEmail draft: ${draft.path}`
    : '';
  console.log(`\nDone. Saved "${fileName}" to ${SAVE_DIR}${draftMsg}\n`);
  await context.close();
}

await main();
