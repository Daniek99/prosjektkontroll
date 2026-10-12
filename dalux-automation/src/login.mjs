// src/login.mjs
// Opens a real (headed) browser, lets you log in to Dalux manually, then
// persists the session two ways:
//   1. ./user-data/      -> a full Chromium profile (survives restarts, handles SSO/2FA)
//   2. ./dalux-auth.json -> a storageState file (cookies + localStorage) for codegen/scripts
//
// Run:  npm run login
//
// Third-party automation note: only use this against an account you are
// authorised to access, and respect Dalux's terms of service.

import { chromium } from '@playwright/test';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const START_URL =
  'https://node1.build.dalux.com/client/725256/project-dashboard/dashboard';
const USER_DATA_DIR = path.join(__dirname, '..', 'user-data');
const STORAGE_STATE = path.join(__dirname, '..', 'dalux-auth.json');
// ──────────────────────────────────────────────────────────────────────────────

const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: false,
  viewport: { width: 1440, height: 900 },
  args: ['--start-maximized'],
});

const page = context.pages()[0] ?? (await context.newPage());
await page.goto(START_URL, { waitUntil: 'domcontentloaded' });

console.log('\n──────────────────────────────────────────────────────────');
console.log(' A browser window has opened.');
console.log(' 1. Log in to Dalux as you normally would (SSO/2FA included).');
console.log(' 2. Wait until the project dashboard is fully visible.');
console.log(' 3. Come back to this terminal and press Enter.');
console.log('──────────────────────────────────────────────────────────\n');

const rl = readline.createInterface({ input, output });
await rl.question('Press Enter once you are logged in and the dashboard is showing... ');

// Persist cookies + localStorage for reuse by scripts / codegen.
await context.storageState({ path: STORAGE_STATE });
console.log(`\n✔ Session saved.`);
console.log(`  • Profile:       ${USER_DATA_DIR}`);
console.log(`  • Storage state: ${STORAGE_STATE}`);
console.log('\nKeep dalux-auth.json SECRET — it grants access to your Dalux session.\n');

await rl.close();
await context.close();
