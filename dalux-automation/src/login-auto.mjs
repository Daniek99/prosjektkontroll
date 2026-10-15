// src/login-auto.mjs
//
// Opens Dalux, waits for you to log in, then saves the session — no terminal
// input required. Started by the dashboard's "Logg inn på Dalux" button via the
// `daluxscheduler://login` protocol.
//
// It polls until the Dalux client is actually loaded (not a login/SSO page),
// then writes the session to ./user-data and ./dalux-auth.json and marks the
// session as OK in Supabase so the panel stops asking for a login.
//
// Run manually:  npm run login:auto

import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const START_URL =
  process.env.DALUX_FIELD_URL ||
  'https://node1.build.dalux.com/client/725256/project-dashboard/dashboard';
const USER_DATA_DIR = path.join(__dirname, '..', 'user-data');
const STORAGE_STATE = path.join(__dirname, '..', 'dalux-auth.json');
const TIMEOUT_MS = Number(process.env.LOGIN_TIMEOUT_MS || 10 * 60 * 1000); // 10 min

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_KEY =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const AUTOMATION_IDS = ['vernerunde-purring', 'vernerunde-utskrift'];

async function setSessionStatus(status) {
  if (!SUPABASE_URL || !(SERVICE_KEY || ANON_KEY)) return;
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY || ANON_KEY, {
      auth: { persistSession: false },
    });
    await supabase.from('automations').update({ session_status: status }).in('id', AUTOMATION_IDS);
  } catch {
    /* best effort */
  }
}

const log = (...a) => console.log('  ', ...a);

const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: false,
  viewport: { width: 1440, height: 900 },
});
const page = context.pages()[0] ?? (await context.newPage());

await page.goto(START_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});

console.log('\n──────────────────────────────────────────────────────────');
console.log(' Logg inn på Dalux i vinduet som åpnet seg.');
console.log(' Vinduet lukkes automatisk når innloggingen er registrert.');
console.log('──────────────────────────────────────────────────────────\n');

const deadline = Date.now() + TIMEOUT_MS;
let ok = false;

while (Date.now() < deadline) {
  const url = page.url();
  const onLoginPage = /login|signin|auth|microsoftonline|adfs|bankid|vipps/i.test(url);

  if (!onLoginPage && /\/client\//.test(url)) {
    // The Dalux client is loaded — confirm the app shell is really there.
    const shell = await page
      .getByText('Lokasjoner', { exact: false })
      .first()
      .isVisible()
      .catch(() => false);
    const shell2 = await page
      .getByText('Dashboard', { exact: false })
      .first()
      .isVisible()
      .catch(() => false);
    if (shell || shell2) {
      ok = true;
      break;
    }
  }
  await page.waitForTimeout(2000);
}

if (ok) {
  await context.storageState({ path: STORAGE_STATE }).catch(() => {});
  await setSessionStatus('ok');
  log('Innlogging registrert — sesjonen er lagret.');
  console.log('LOGIN_OK');
} else {
  log('Tidsavbrudd: innloggingen ble ikke fullført.');
  console.log('LOGIN_TIMEOUT');
}

await context.close();
process.exit(ok ? 0 : 1);
