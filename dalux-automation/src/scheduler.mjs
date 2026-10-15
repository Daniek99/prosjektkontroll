// src/scheduler.mjs
//
// Runs the Dalux automations on their schedules — and immediately when the
// user presses "Kjør nå" in the app.
//
// The on/off flags, run requests and live progress live in Supabase (table
// `automations`) so they can be controlled and watched from the web app's
// Automations panel on the homepage. This process only fires a script when its
// automation is ENABLED, or when a run has been explicitly requested.
//
// Run state written to the row:
//   run_status      queued -> running -> done | failed
//   run_started_at / run_finished_at
//   run_progress    latest line from the running script
//
// Registered automations (id -> script):
//   vernerunde-purring   -> dalux-field-purring.mjs   (Wed 14:00)
//   vernerunde-utskrift  -> dalux-field-print.mjs     (Tue 08:00)
//
// Run:  npm run schedule
// Test: DRY_RUN=1 npm run schedule   (the Playwright runs rehearse, never send)
//       node src/scheduler.mjs --once   (one tick of every automation, then exit)
//
// The Playwright scripts need a saved session: run `npm run login` once.

import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { spawn, spawnSync } from 'node:child_process';
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

// How often to check for "Kjør nå" requests from the app.
const POLL_MS = Number(process.env.POLL_MS || 20000);
// How often progress lines are written back to Supabase (ms).
const PROGRESS_THROTTLE_MS = Number(process.env.PROGRESS_THROTTLE_MS || 2000);

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

async function setRunState(id, patch) {
  const { error } = await supabase.from('automations').update(patch).eq('id', id);
  if (error) console.error(`Failed to update run state for "${id}":`, error.message);
}

/** Tell the app the scheduler is alive (drives the online/offline indicator). */
async function heartbeat() {
  const { error } = await supabase
    .from('automations')
    .update({ scheduler_heartbeat_at: new Date().toISOString() })
    .in('id', AUTOMATION_REGISTRY.map((e) => e.id));
  if (error) console.error('heartbeat failed:', error.message);
}

const children = new Map(); // automation id -> running child process
const stopped = new Set(); // ids stopped by the user

/** Run a script, forwarding its output and reporting progress lines. */
function runScript(entryId, script, onLine) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, script)], {
      env: { ...process.env, AUTO: '1' }, // scheduled run: no confirmation prompt
    });
    children.set(entryId, child);
    const handle = (buf) => {
      const text = buf.toString();
      process.stdout.write(text);
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (t) onLine(t);
      }
    };
    child.stdout?.on('data', handle);
    child.stderr?.on('data', (b) => process.stderr.write(b));
    child.on('exit', (code) => {
      children.delete(entryId);
      resolve(code ?? 1);
    });
    child.on('error', (e) => {
      console.error(`Failed to start ${script}:`, e.message);
      children.delete(entryId);
      resolve(1);
    });
  });
}

/** Kill a running automation (and its browser) on request from the app. */
function killChild(entryId) {
  const child = children.get(entryId);
  if (!child) return false;
  stopped.add(entryId);
  try {
    // /T kills the whole tree (node + Chromium), /F forces it.
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    child.kill();
  }
  return true;
}

/** Run one automation end-to-end, publishing live progress to Supabase. */
async function runEntry(entry, row, reason) {
  if (running.has(entry.id)) {
    console.log(`[${entry.id}] previous run still in progress — skipping (${reason}).`);
    return;
  }
  running.add(entry.id);

  await setRunState(entry.id, {
    run_status: 'running',
    run_started_at: new Date().toISOString(),
    run_finished_at: null,
    run_progress: `Starter (${reason})…`,
  });

  let lastWrite = 0;
  const onLine = (line) => {
    const now = Date.now();
    if (now - lastWrite < PROGRESS_THROTTLE_MS) return;
    lastWrite = now;
    setRunState(entry.id, { run_progress: line.slice(0, 200) }).catch(() => {});
  };

  try {
    console.log(
      `\n=== [${entry.id}] Running "${row.name}" (${reason}) at ${new Date().toLocaleString('no-NO')} ===`
    );
    const code = await runScript(entry.id, entry.script, onLine);
    const wasStopped = stopped.delete(entry.id);
    const ok = code === 0 && !wasStopped;
    await setRunState(entry.id, {
      run_status: wasStopped ? 'stopped' : ok ? 'done' : 'failed',
      run_finished_at: new Date().toISOString(),
      run_progress: wasStopped ? 'Stoppet av bruker' : ok ? 'Fullført' : `Feilet (kode ${code})`,
      last_run_at: new Date().toISOString(),
      last_run_status: wasStopped ? 'Stoppet av bruker' : ok ? 'OK' : `Feilet (kode ${code})`,
    });
    console.log(`=== [${entry.id}] Finished (exit code ${code}) ===`);
  } catch (e) {
    console.error(`[${entry.id}] run failed:`, e.message);
    await setRunState(entry.id, {
      run_status: 'failed',
      run_finished_at: new Date().toISOString(),
      run_progress: `Feilet: ${e.message}`.slice(0, 200),
      last_run_at: new Date().toISOString(),
      last_run_status: `Feilet: ${e.message}`,
    });
  } finally {
    running.delete(entry.id);
  }
}

/** Cron tick: only runs when the automation is enabled. */
function makeTick(entry) {
  return async function tick() {
    const row = await getAutomation(entry.id);
    if (!row) {
      console.log(`[${entry.id}] no automation row — nothing to do.`);
      return;
    }
    if (!row.enabled) {
      console.log(`[${new Date().toLocaleString('no-NO')}] "${row.name}" is disabled — skipping.`);
      return;
    }
    await runEntry(entry, row, 'cron');
  };
}

/**
 * "Kjør nå" from the app: the widget sets `run_requested_at`; we clear it and
 * run immediately. This bypasses the schedule AND the enabled flag — it is an
 * explicit user action.
 */
async function pollRunRequests() {
  await heartbeat();
  for (const entry of AUTOMATION_REGISTRY) {
    let row;
    try {
      row = await getAutomation(entry.id);
    } catch {
      continue;
    }
    if (!row?.run_requested_at) continue;

    // Clear the request first so a long run can't be triggered twice.
    const { error } = await supabase
      .from('automations')
      .update({ run_requested_at: null })
      .eq('id', entry.id);
    if (error) {
      console.error(`[${entry.id}] failed to clear run request:`, error.message);
      continue;
    }
    await runEntry(entry, row, 'manuell "Kjør nå"');
  }
}

/**
 * "Stopp" from the app: the widget sets `stop_requested_at`; we clear it and
 * terminate the running script (and its browser) for that automation.
 */
async function pollStopRequests() {
  for (const entry of AUTOMATION_REGISTRY) {
    let row;
    try {
      row = await getAutomation(entry.id);
    } catch {
      continue;
    }
    if (!row?.stop_requested_at) continue;

    await supabase.from('automations').update({ stop_requested_at: null }).eq('id', entry.id);

    if (killChild(entry.id)) {
      console.log(`[${entry.id}] stop requested from the app — terminating the run.`);
    } else {
      console.log(`[${entry.id}] stop requested but nothing is running.`);
      await setRunState(entry.id, { run_status: 'done', run_progress: 'Ingen kjøring pågikk' });
    }
  }
}

await heartbeat();

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
  await pollStopRequests();
  await pollRunRequests(); // also honour any pending "Kjør nå"
  console.log('\n(--once) done.');
  process.exit(0);
}

setInterval(async () => {
  await pollStopRequests();
  await pollRunRequests();
}, POLL_MS).unref();
console.log(`\nScheduler running. "Kjør nå" / "Stopp" requests are polled every ${POLL_MS / 1000}s.`);
console.log('Keep this process open (or use --once from Task Scheduler).');
