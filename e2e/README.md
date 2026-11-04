# End-to-end tests

Browser tests for the key dsarecx flows, written with [Playwright](https://playwright.dev).

| Spec | What it checks |
| --- | --- |
| `learning-path.spec.ts` | System Design opens on the Learning paths tab with 7 paths; in System Design Fundamentals only article 1 can be marked learned, then article 2 is "Up next"; the API refuses to skip ahead (409 `PATH_ORDER`). |
| `concept-review.spec.ts` | On the "Library & log" tab, log a library concept learned 10 days ago, see it listed as due, find it in Daily, reveal notes, rate it Clean, and see it under Completed Today. |
| `settings.spec.ts` | Change the daily goal in Settings and it persists after a reload; invalid review intervals can't be saved. |

## How a run works

1. `global-setup.ts` creates a fresh, verified user (`e2e-<timestamp>@example.com`) straight in the database
   with Prisma, writes its credentials to `e2e/.auth/user.json`, and clears the `RateLimit` table so repeated
   runs don't hit the login limit.
2. The `setup` project (`auth.setup.ts`) signs in through the real login form and saves the session to
   `e2e/.auth/state.json`. Every spec starts signed in with it.
3. Specs that need data clear the user's problems first (`clearUserData` in `helpers.ts`), so each test
   (and its retry) starts from an empty account.
4. `global-teardown.ts` deletes the test user; everything it owns goes with it.

Tests run with one worker because they share a database and a user. `e2e/.auth/`, `playwright-report/` and
`test-results/` are gitignored.

## Running locally

You need the app running and the same `DATABASE_URL` it uses (read from `.env`).

```bash
npm run dev            # in another terminal; or `npm run build && npm run start`
npm run test:e2e       # = npx playwright test
```

Browser: by default Playwright uses its own Chromium (`npx playwright install chromium` downloads it).
On a machine without downloaded Playwright browsers, use an installed browser through `PW_CHANNEL`:

```bash
PW_CHANNEL=msedge npx playwright test        # Microsoft Edge
PW_CHANNEL=chrome npx playwright test        # Google Chrome
```

```powershell
$env:PW_CHANNEL='msedge'; npx playwright test
```

Other options:

- `E2E_BASE_URL=http://localhost:3001` to test a server on another URL (default `http://localhost:3000`).
- `E2E_START_SERVER=1` to have Playwright run `npm run start` itself (build first). An already running server
  on that URL is reused.
- `npx playwright test --ui` or `--headed` to watch, `npx playwright show-report` after a run.

The tests never use or change any existing account; they only touch the `e2e-…@example.com` user they create.

## CI

In CI, run against a fresh Postgres: `prisma migrate deploy`, `npm run build`, install Playwright's Chromium,
then `E2E_START_SERVER=1 npx playwright test`. `playwright.config.ts` retries a failed test once on CI and
records a trace on that retry; upload `playwright-report/` and `test-results/` as artifacts on failure.
