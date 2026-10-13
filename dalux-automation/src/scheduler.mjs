// src/scheduler.mjs
//
// Runs the Dalux automations on their schedules.
//
// The on/off flags live in Supabase (table `automations`) so they can be
// controlled from the web app's Automations panel on the homepage. This
// process only fires a script when its automation is ENABLED.
//
// Registered automations (id -> script):
//   vernerunde-purring   -> dalux-field-purring.mjs   (Wed 14:00)
//   vernerunde-utskrift  -> dalux-field-print.mjs     (Tue 08:00)
//
// The schedule for each is read from its `automations` row, so it can be
// changed in the database without touching this file.
//
// Run:  npm run schedule
// Test: DRY_RUN=1 npm run schedule   (the Playwright runs rehearse, never send)
//       node src/scheduler.mjs --once   (one tick of every automation, then exit)
//
// The Playwright scripts need a saved session: run `npm run login` once.

import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load credentials: the app's .env.local (one level up) and any local .env here.
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const AUTOMATION_REGISTRY = [
  { id: 'vernerunde-purring', script: 'dalux-field-purring.mjs' },
  { id: 'vernerunde-utskrift', script: 'dalux-field-print.mjs' },
];

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_KEY =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !(SERVICE_KEY || ANON_KEY)) {
  console.error(
    'Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY\n' +
      '(the service role key is required so the scheduler can read the flags despite RLS).'
  );
  process.exit(1);
}

// The service role key bypasses RLS; the anon key would be blocked by it.
const supabase = createClient(SUPABASE_URL, SERVICE_KEY || ANON_KEY, {
  auth: { persistSession: false },
});

const running = new Set();

async function getAutomation(id) {
  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error(`Failed to read the automation row "${id}":`, error.message);
    return null;
  }
  return data;
}

async function markRun(id, status) {
  const { error } = await supabase
    .from('automations')
    .update({ last_run_at: new Date().toISOString(), last_run_status: status })
    .eq('id', id);
  if (error) console.error('Failed to update last_run:', error.message);
}

function runScript(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, script)], {
      env: { ...process.env, AUTO: '1' }, // scheduled run: no confirmation prompt
      stdio: 'inherit',
    });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', (e) => {
      console.error(`Failed to start ${script}:`, e.message);
      resolve(1);
    });
  });
}

function makeTick(entry) {
  return async function tick() {
    if (running.has(entry.id)) {
      console.log(`[${entry.id}] previous run still in progress — skipping.`);
      return;
    }
    running.add(entry.id);
    try {
      const row = await getAutomation(entry.id);
      if (!row) {
        console.log(`[${entry.id}] no automation row — nothing to do.`);
        return;
      }
      if (!row.enabled) {
        console.log(`[${new Date().toLocaleString('no-NO')}] "${row.name}" is disabled — skipping.`);
        return;
      }
      console.log(`\n=== [${entry.id}] Running "${row.name}" at ${new Date().toLocaleString('no-NO')} ===`);
      const code = await runScript(entry.script);
      await markRun(entry.id, code === 0 ? 'OK' : `Feilet (kode ${code})`);
      console.log(`=== [${entry.id}] Finished (exit code ${code}) ===`);
    } catch (e) {
      console.error(`[${entry.id}] tick failed:`, e.message);
      await markRun(entry.id, `Feilet: ${e.message}`).catch(() => {});
    } finally {
      running.delete(entry.id);
    }
  };
}

const ONCE = process.argv.includes('--once');

for (const entry of AUTOMATION_REGISTRY) {
  const row = await getAutomation(entry.id);
  const schedule = row?.schedule || '0 14 * * 3';
  if (!cron.validate(schedule)) {
    console.error(`[${entry.id}] invalid cron expression: "${schedule}" — skipped.`);
    continue;
  }
  const tick = makeTick(entry);
  console.log(`[${entry.id}] scheduled: "${schedule}" (local time) — ${row?.enabled ? 'ENABLED' : 'disabled'}`);
  if (ONCE) {
    await tick();
  } else {
    cron.schedule(schedule, tick);
  }
}

if (ONCE) {
  console.log('\n(--once) done.');
  process.exit(0);
}

console.log('\nScheduler running. Keep this process open (or use --once from Task Scheduler).');
