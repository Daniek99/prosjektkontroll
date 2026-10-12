# Dalux Automation (Playwright)

Standalone Playwright project for automating the **Dalux Build** web client, because
API access is not available / not enabled for our account.

- Target: `https://node1.build.dalux.com/client/725256/project-dashboard/dashboard`
- Approach: drive the **real browser UI** with a saved login session.
- No API key required.

> Only automate an account you are authorised to use, and respect Dalux's terms of service.

---

## 1. Why not the API?

Dalux Build *does* have a REST API, but access is gated:

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

A browser opens. Log in manually (SSO / 2FA all supported). When the project
dashboard is showing, return to the terminal and press **Enter**. The session is
saved to:

- `user-data/` — full Chromium profile (used by the scripts)
- `dalux-auth.json` — storage state (used by `codegen`)

**Both contain live session credentials. They are git-ignored — keep them secret.**

## 4. Verify the session works

```bash
npm run screenshot
```

Writes `dalux-dashboard.png` and prints the URL/title. If it warns about a login
redirect, just re-run `npm run login`.

## 5. Record the operations you want to automate

```bash
npm run codegen
```

Playwright Inspector opens with the saved session loaded. Click through the
operation you want (create a task, upload a file, export a report, …). The
inspector generates selectors; copy them into a new script (start from
`src/screenshot.mjs`).

Example of resilient locators (prefer these over CSS/`nth-child` paths):

```js
await page.getByRole('button', { name: 'New task' }).click();
await page.getByLabel('Title').fill('Erect scaffold');
await page.getByText('Save').click();

const rows = await page.locator('[data-testid="task-row"]').allInnerTexts();
```

## 6. Scheduling / headless

Once a script is stable, set `headless: true` and run it from Windows Task
Scheduler, e.g.:

```bat
cd /d C:\Users\NO-daek\.gemini\antigravity\playground\pyro-planetary\gc-app\dalux-automation
npm run screenshot
```

---

## Project layout

```
dalux-automation/
├─ package.json
├─ README.md
├─ .gitignore
├─ src/
│  ├─ login.mjs        # manual login -> saves session
│  └─ screenshot.mjs   # template: reuse session, do something, screenshot
├─ user-data/          # git-ignored: Chromium profile with your session
└─ dalux-auth.json     # git-ignored: storage state for codegen
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Executable doesn't exist` | Run `npm run install:browsers` |
| Redirected to login | Session expired → `npm run login` |
| Selector works in codegen but not later | The SPA hadn't finished loading — add `await page.getByRole(...).waitFor()` |
| SSO/2FA prompts every run | Make sure scripts reuse `user-data/` (persistent context), not a fresh context |
| Corporate proxy / TLS errors | Add `proxy` / `ignoreHTTPSErrors` to the `launchPersistentContext` options |
