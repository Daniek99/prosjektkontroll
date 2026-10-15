# Dalux Automation (Playwright)

Standalone Playwright project for automating the **Dalux Field** web client, because
API access is not available / not enabled for our account.

- Start URL: `https://node1.build.dalux.com/client/725256/project-dashboard/dashboard`
- Approach: drive the **real browser UI** with a saved login session.
- No API key required.

> Only automate an account you are authorised to use, and respect Dalux's terms of service.

---

## 1. Why not the API?

Dalux does have a REST API, but access is gated:

- It must be **activated for the company profile by Dalux** (contact `support@dalux.com`
  or your Dalux Customer Success Manager).
- The `API identities` menu is only visible to **Company administrators**.
- Path when enabled: **Company profile → Settings → Company overview → API identities**
  (older keys expire **Feb 28, 2026**).

If that ever gets enabled, migrate to the API — it is more stable than UI automation.

---

## 2. One-time setup

```bash
cd dalux-automation
npm install
npm run install:browsers   # downloads the Chromium build Playwright uses
```

## 3. Log in once and save the session

```bash
npm run login
```

A browser opens. Log in manually (SSO / 2FA all supported). When the dashboard is
showing, return to the terminal and press **Enter**. The session is saved to:

- `user-data/` — full Chromium profile (used by the scripts)
- `dalux-auth.json` — storage state (used by `codegen`)

**Both contain live session credentials. They are git-ignored — keep them secret.**

## 4. Verify the session works

```bash
npm run screenshot
```

Writes `dalux-dashboard.png` and prints the URL/title. If it warns about a login
redirect, just re-run `npm run login`.

## 5. Record operations you want to automate

```bash
npm run codegen
```

Playwright Inspector opens with the saved session loaded. Click through the
operation; the inspector generates selectors you can copy into a new script
(start from `src/screenshot.mjs`).

Example of resilient locators:

```js
await page.getByRole('button', { name: 'New task' }).click();
await page.getByLabel('Title').fill('Erect scaffold');
await page.getByText('Save').click();
```

## 6. Scheduling / headless

Once a script is stable, set `headless: true` and run it from Windows Task
Scheduler, e.g.:

```bat
cd /d C:\Users\NO-daek\.gemini\antigravity\playground\pyro-planetary\gc-app\dalux-automation
npm run screenshot
```

---

## 7. Automation: Dalux Field — "Purring" notifications

Script: [`src/dalux-field-purring.mjs`](src/dalux-field-purring.mjs). It reproduces this
manual flow:

```
Dashboard -> Field -> Sjekklister -> 22. HMS -> Til verneleder -> Verne- og miljørunde
  each list row has a 12x12 status dot:
     orange #FF6600  "Påbegynt"   = unfinished   <- processed
     green  #24A05B  "Avsluttet"  = done         (ignored)
     yellow                       = other        (ignored)
  for each ORANGE row:
     click its Nr. link  -> expanded task window opens
        -> "Mer" (dialog toolbar) -> "Notifiser"
        -> "Beskjed" dialog: search "Daniel Ekman", tick the box,
           type "Purring" in the message, Send
     -> close the window, continue with the next orange row
```

```bash
DRY_RUN=1 npm run dalux:purring     # rehearse: fills the form but does NOT Send
npm run dalux:purring               # real run (asks for confirmation first)
```

Environment flags:

| Var | Default | Meaning |
|---|---|---|
| `DALUX_FIELD_URL` | dashboard URL | Starting URL (unified client) |
| `DRY_RUN` | `0` | `1` = do everything except press Send |
| `HEADLESS` | `0` | `1` = run without a visible window |
| `SLOW_MO` | `200` | ms between actions (make it visible while developing) |
| `MAX_ITEMS` | `50` | safety cap on how many registrations to process |
| `DUMP` | `0` | `1` = save a screenshot + HTML to `./debug` at each step |

### Selectors (verified against the live app)

These were captured from the real DOM and are hard-coded in the script:

- Field module URL: `/client/725256/quality-control/home`.
- Sidebar tree rows; the walk is `Sjekklister → 22. HMS → Til verneleder → Verne- og miljørunde`.
- List rows are `<tr>` with `td.virtual-data-grid-cell`; the Nr. link is
  `dlx-text.dlx-underline-on-hover`; the status dot is a `12x12` `div` with
  `border-radius:100%` and the colours above.
- Expanded task window = `div.dialog-window`; its toolbar is `.dialog-toolbar` (contains "Mer").
- "Notifiser" menu item.
- "Beskjed" dialog: recipient search = `input[type=text]`; message = `textarea`;
  the person checkbox is a **custom (visually hidden) input**, so it is selected with
  `check({ force: true })` (falling back to clicking the visible box element).

If Dalux's UI changes, re-capture with:

```bash
DUMP=1 DRY_RUN=1 npm run dalux:purring   # writes screenshots + HTML to ./debug
```

---

## 8. Schedules

The on/off switches live in the app (homepage → **Automasjoner**) and are stored in
Supabase (table `automations`), so the browser and this scheduler share the same state.
Both automations are **disabled by default** until the setup is complete.

| Automation | Script | Schedule (cron, local time) |
|---|---|---|
| Vernerunde purring | `dalux-field-purring.mjs` | `0 14 * * 3` — Wednesday 14:00 |
| Vernerunde utskrift | `dalux-field-print.mjs` | `0 8 * * 2` — Tuesday 08:00 |

```bash
npm run schedule                 # resident scheduler: fires on the cron schedule
node src/scheduler.mjs --once    # run one tick now and exit (also for Task Scheduler)
```

**"Kjør nå"** in the app: the button next to each automation sets
`run_requested_at` in Supabase. The scheduler polls for it every ~20 s
(`POLL_MS`), clears it and runs the script immediately — bypassing both the
schedule and the enabled flag (it is an explicit user action). The scheduler
process must be running for it to work.

**Live progress:** while a run is in flight the scheduler writes `run_status`
(`queued → running → done | failed`), `run_started_at` / `run_finished_at` and
`run_progress` (the latest line from the script, throttled to every 2 s). The
panel polls every 8 s and shows a spinner, the elapsed time and the current step
(e.g. `Kjører (1:23): → task 3/15 Gjør3368 …`).

**Scheduler heartbeat:** the scheduler stamps `scheduler_heartbeat_at` on every
poll, so the panel shows **Scheduler online/offline**. If a run is queued while
it is offline, the panel says so — that is the usual reason "Kjør nå" appears to
do nothing.

- Each automation's cron is stored in its `automations` row (local time).
- On each tick the scheduler reads `enabled`; if it is off, nothing runs.
- When it runs, the Playwright script starts with `AUTO=1` (no confirmation prompt)
  and processes **all orange tasks** in the checklist.
- The result is written back to `last_run_at` / `last_run_status`, which the app shows.
- Credentials come from the app's `.env.local` (`VITE_SUPABASE_URL` +
  `VITE_SUPABASE_SERVICE_ROLE_KEY`). The service role key is required because RLS
  blocks the anon key, and it never leaves this machine.

Test the whole chain without sending anything:

```bash
DRY_RUN=1 node src/scheduler.mjs --once
```

---

## 9. Automation: Vernerunde utskrift (Tuesday 08:00)

Script: [`src/dalux-field-print.mjs`](src/dalux-field-print.mjs).

```
Dashboard -> Field -> Sjekklister -> 22. HMS -> Til verneleder -> Verne- og miljørunde
  -> open the NEWEST checklist (first row)
     -> "Skriv ut" (checklist toolbar)
        -> tick "Ta med oppgaver"
        -> click the "Håndverkerrapport" card
        -> tick "Enkel"
        -> "Skriv ut" -> wait for the file -> "Åpne"
  -> save as  Vernerunde uke <ISO week> <year>.pdf
     in C:\Users\NO-daek\Veidekke\OBOS - Hammersborg torg - General\HMS\HMS15 Verneprotokoll
```

```bash
DRY_RUN=1 npm run dalux:print    # stops before generating the file
npm run dalux:print              # generates and saves the PDF
```

- The PDF is captured via Playwright's download event (with a new-tab fallback) and
  saved directly — no manual "Save as" dialog. Locked files (PDF open in a viewer)
  are retried for ~5 minutes.
- The save folder and filename prefix are configurable: `PRINT_SAVE_DIR`, `FILE_PREFIX`.

**Email draft (same automation):** after the PDF is saved, the report content is
extracted (the overall grades plus the keywords from the main text field), the
recipients are pulled from the **"Vernerunde"** category in the `contacts` table,
and a draft is created **in the Outlook Drafts folder** — via COM automation
(`scripts/outlook-draft.ps1`), so it is **never sent** — with the PDF attached.
If Outlook isn't available, a `.eml` is written next to the PDF instead.
Configurable: `EMAIL_FROM` (default `daniel.ekman@veidekke.no`), `EMAIL_CATEGORY`,
`EMAIL_PROJECT`.

---

## Project layout

```
dalux-automation/
├─ package.json
├─ README.md
├─ .gitignore
├─ src/
│  ├─ login.mjs                 # manual login -> saves session
│  ├─ screenshot.mjs            # template: reuse session, do something, screenshot
│  ├─ dalux-field-purring.mjs   # Dalux Field checklist "Purring" notifications
│  ├─ dalux-field-print.mjs     # Print newest vernerunde as Håndverkerrapport PDF
│  └─ scheduler.mjs             # cron: runs each script when its flag is enabled
├─ user-data/          # git-ignored: Chromium profile with your session
└─ dalux-auth.json     # git-ignored: storage state for codegen
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Executable doesn't exist` | Run `npm run install:browsers` |
| Redirected to login | Session expired → `npm run login` |
| Selector works in codegen but not later | The SPA hadn't finished loading — add `await page.getByRole(...).waitFor()` |
| `check()` times out on the recipient | Dalux uses a hidden checkbox → `check({ force: true })` (already handled) |
| SSO/2FA prompts every run | Make sure scripts reuse `user-data/` (persistent context), not a fresh context |
| Corporate proxy / TLS errors | Add `proxy` / `ignoreHTTPSErrors` to the `launchPersistentContext` options |
