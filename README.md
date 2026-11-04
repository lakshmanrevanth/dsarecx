<div align="center">

# dsarecx

**Solve it once. Recall it for good.** Spaced repetition for DSA problems and system design.

[![Next.js](https://img.shields.io/badge/Next.js-16.2.9-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19.3-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Neon](https://img.shields.io/badge/Database-Neon%20Postgres-00E599?style=flat-square&logo=postgresql)](https://neon.tech/)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

</div>

---

## What it is

Solving a problem once doesn't mean you'll remember it weeks later in an interview. dsarecx is an open-source spaced-repetition tracker for interview prep. You add a problem once, and it schedules reviews at growing intervals (3 → 7 → 14 → 30 days by default), adjusting to how well you actually recalled it each time.

- **Coding problems.** LeetCode, Codeforces, GeeksforGeeks, HackerRank and CodeChef, with metadata filled in automatically from more than **18,000 indexed problems**. Includes an inline editable tracker, a daily review queue, streaks and an activity heatmap.
- **System design.** A built-in library of 58 concepts in 10 categories, plus 7 ordered learning paths (66 articles). You read each one once, then review it on the same schedule. Each comes with recall questions to answer from memory before you rate yourself.

---

## Why it's built this way (and why it runs on Neon + Vercel)

The project relies on both platforms on purpose:

- **Neon.** Chosen for its serverless Postgres model. dsarecx uses Neon's two connection strings: pooled (PgBouncer) for every runtime query, and direct for migrations. This lets Vercel's concurrent serverless functions share a small number of real connections. See [Building with Neon](#building-with-neon) below.
- **Vercel.** The whole app is an idiomatic Next.js 16 App Router project. Server Components and Route Handlers are the API layer. There are no background jobs: nothing runs, and nothing is sent, unless you open the app.

---

## How the scheduling engine works

The scheduling logic lives in [`src/lib/scheduling.ts`](src/lib/scheduling.ts). It is a set of deterministic, pure functions with no database access, covered by unit tests in [`src/lib/scheduling.test.ts`](src/lib/scheduling.test.ts).

### The revision ladder

Every tracked problem climbs a 4-step ladder. The defaults are `LADDER_DAYS = [3, 7, 14, 30]`, and each user can set their own 4 intervals in Settings.

| Step | Next review |
|---|---|
| 0 | 3 days (the first review of every new problem, counted from its solve date) |
| 1 | 7 days |
| 2 | 14 days |
| 3 | 30 days |

### Ratings and transitions

**Regular review** (active problems):
- **`CLEAN`**: moves to the next step. At step 3 the problem becomes **`MASTERED`** and leaves the active queue.
- **`SHAKY`**: repeats the current interval.
- **`STRUGGLED`**: goes back to step 0.

**Recheck review** (a mastered problem coming back):
- Mastered problems come back automatically after **90 days**. "Revise again" also scores the review as a recheck.
- **`CLEAN`**: back to mastered (fast-forward to step 3).
- **`SHAKY`**: placed at step 1.
- **`STRUGGLED`**: full reset to step 0.

### Lifecycle rules

- Overdue problems never drop off. They stay in the daily queue, weakest first, and the next date is counted from the day you actually reviewed them.
- One rating per problem per local day. A second rating returns `409`. You can change or undo today's rating, but nothing older.
- Every day boundary uses the user's own time zone: the saved setting if there is one, otherwise a `tz` cookie set by the browser. The helpers are in `src/lib/dates.ts`.
- Streaks count back from today, or from yesterday if you haven't reviewed yet today. Optionally, a day only counts once the daily goal is met.

---

## Features

- **Today.** The home page after sign-in, for students: what you learned today (DSA problems and system design concepts, split in two), how many reviews are due with a "Start review" button, and a **to-learn list**. Add the next problem (title, number or pasted link, looked up automatically) or concept with an optional target date, reorder it, and press "Learned it" when done: it becomes a tracked problem or concept and enters the review schedule. No notifications of any kind.
- **Platform resolvers.** `LEETCODE`, `CODEFORCES`, `GFG`, `HACKERRANK` and `CODECHEF` each implement the shared `PlatformResolver` interface, so adding a platform means adding one file.
  - LeetCode: in-memory lookup, falling back to LeetCode's public GraphQL API for problems not in the dataset.
  - Codeforces: lookup by code (`4A`) or ID, falling back to the live problemset API.
  - CodeChef: lookup by code, ID, title or URL.
  - GFG and HackerRank: seed datasets, with titles parsed from the URL slug as a fallback.
- **Inline tracker.** Draft rows, editable cells, autosave and undoable deletes. Filters for platform, topic or tag, overdue, due this week, list and group-by, kept in the URL.
- **Custom columns.** Text, select, date, checkbox and link types. Values are stored in the `Problem.customFields` JSON column and updated atomically, so no migration is needed for each new column.
- **Lists and tags.** Named lists (Blind 75, NeetCode 150, …) with bulk "Add to list".
- **Bulk actions.** Status changes, deletes and list adds are sent as one request and run in a single transaction.
- **Daily review.** Recall → reveal notes → rate. Includes focus mode, keyboard shortcuts, snooze (1d/3d/1w), retire, and undo for today's ratings.
- **AI recall questions.** When `ANTHROPIC_API_KEY` is set, Claude writes recall questions for a problem or concept.
- **Import and export.** CSV, Excel and JSON import, plus a full JSON backup (v2, including the to-learn list) that restores everything with Skip, Merge or Overwrite. CSV export guards against spreadsheet formulas.
- **Auth.** NextAuth v5 with Google, GitHub and email + password. Email codes lock after 5 wrong tries. Every auth route has per-IP and per-email rate limits, and responses never reveal whether an account exists. Redirects after login stay on the same site, and a password change ends other sessions within 5 minutes. Cross-provider account linking removes an unverified password, which stops a pre-registration takeover.

---

## Tech stack

**Framework:** Next.js 16 (App Router, React 19) · **Language:** TypeScript 5 · **Database:** Neon serverless Postgres · **ORM:** Prisma 6.19.3 · **Auth:** NextAuth v5 + `@auth/prisma-adapter` · **Email:** Resend · **AI:** Anthropic SDK · **Styling:** Tailwind CSS 4 · **Data fetching:** SWR · **Testing:** Vitest, Playwright · **Hosting:** Vercel

---

## Building with Neon

This section is for developers setting up Neon in a serverless Next.js app, where a common mistake is easy to make and hard to diagnose.

### The problem

Vercel can run many function invocations at once. If each one opens its own direct Postgres connection, you hit Neon's connection limit quickly. The resulting `too many connections` errors only show up under load, never in local dev.

### The fix: two connection strings with two jobs

Neon gives you a **pooled** endpoint (through PgBouncer) and a **direct** one. They are not interchangeable:

```prisma
// prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled: every runtime query
  directUrl = env("DIRECT_URL")     // direct: migrations only
}
```

- **`DATABASE_URL`**: the pooled string (the hostname contains `-pooler`). Every API route and Server Component query uses it.
- **`DIRECT_URL`**: the non-pooled string. PgBouncer's transaction mode doesn't support some DDL that migrations need, so only `prisma migrate` and `prisma db push` use it, never the running app.

### The second half: one PrismaClient

[`src/lib/prisma.ts`](src/lib/prisma.ts) keeps a single client on `globalThis`, so hot reloads in development don't create new clients. Import `prisma` from that file everywhere, and never call `new PrismaClient()` anywhere else.

### Checking that it works

Before shipping, fire 50 concurrent requests at a live API route with `Promise.all()` and check for connection or pool errors. With the pooled URL there should be none.

### Pin your Prisma version

An unpinned install once drifted onto Prisma 7, which moves the datasource into `prisma.config.ts`. That broke the two-URL setup in a way that looked like a Neon problem. Prisma is pinned to `6.19.3` for that reason.

---

## Database schema

| Model | Purpose |
|---|---|
| `User` | Account, hashed password, preferences (time zone, daily goal, intervals, streak mode) |
| `Account`, `Session`, `VerificationToken` | NextAuth OAuth and verification data |
| `Problem` | Platform, code, ladder step (0–3), status (`ACTIVE` / `MASTERED` / `RETIRED`), `nextRevisionAt`, tags, `customFields` JSON. System design concepts use the `SYSTEM_DESIGN` platform. |
| `Revision` | Full history: rating, review type, step before and after |
| `StreakLog` | Daily completion log |
| `UserColumnConfig` | Each user's custom column definitions |
| `ProblemList` | Named lists and their problems |
| `StudyItem` | The to-learn list: kind (`DSA` / `SYSTEM_DESIGN`), title, link, platform + identifier, difficulty, topic, note, target date, order |
| `RateLimit` | Fixed-window counters for the auth rate limits |

See `prisma/schema.prisma` for the exact definitions.

---

## API reference

All routes except `auth/*` and `github/stars` need a signed-in session.

| Method | Endpoint | Description |
|---|---|---|
| `GET`, `POST`, `DELETE` | `/api/problems` | List with filters, create (metadata is resolved automatically), delete several |
| `PATCH`, `DELETE` | `/api/problems/[id]` | Update fields (a status or solve-date change reschedules), delete |
| `PATCH` | `/api/problems/[id]/revise` | Submit a rating. `409` if already rated today. |
| `PATCH` | `/api/problems/[id]/revise-again` | Bring a mastered problem back as a recheck |
| `PATCH` | `/api/problems/[id]/retire` | Retire a problem |
| `POST` | `/api/problems/[id]/snooze` | Snooze 1, 3 or 7 days |
| `POST` | `/api/problems/[id]/undo-revision` | Undo today's rating, checked against the revision id |
| `PATCH` | `/api/problems/[id]/custom-fields` | Atomic custom-field update |
| `POST`, `PUT` | `/api/problems/[id]/questions` | Generate (AI) or save recall questions |
| `POST` | `/api/problems/bulk` | Bulk status, delete or list action in one transaction |
| `GET` | `/api/problems/due` | Due and overdue problems |
| `GET` | `/api/problems/revised-today` | Problems rated today (local day) |
| `POST` | `/api/problems/import` | Import rows or a v2 backup (skip, merge or overwrite) |
| `GET`, `POST` | `/api/concepts` | System design library and paths progress; log a concept. Path order is enforced. |
| `GET`, `POST`, `DELETE` | `/api/columns` | Custom column definitions |
| `PATCH`, `DELETE` | `/api/columns/[id]` | Rename, retype or reorder a column; delete it |
| `GET`, `POST` | `/api/lists` | Named lists |
| `PATCH`, `DELETE` | `/api/lists/[id]` | Rename or delete a list |
| `POST` | `/api/lists/[id]/problems` | Add or remove problems |
| `GET` | `/api/activity` | 365-day activity for the heatmap |
| `GET` | `/api/streak` | Current streak and today's status |
| `GET` | `/api/stats` | Dashboard statistics |
| `GET` | `/api/daily/summary` | Daily page data in one request |
| `GET` | `/api/today` | Today page in one request: learned today (DSA / system design), revised count, due count + first five, to-learn list, streak |
| `GET`, `POST`, `PATCH` | `/api/study` | To-learn list in order; add an item; reorder (`{ ids }`, every id once) |
| `PATCH`, `DELETE` | `/api/study/[id]` | Edit or delete a to-learn item |
| `GET`, `POST` | `/api/export` | JSON backup (v2) or formula-safe CSV, optionally for selected ids |
| `GET`, `PATCH` | `/api/settings` | Preferences |
| `GET`, `DELETE` | `/api/account` | Account info; delete the account |
| `POST` | `/api/account/password` | Change or set a password (ends other sessions) |
| `POST` | `/api/account/email`, `/api/account/email/verify` | Change email, verified by a code |
| `DELETE` | `/api/account/providers/[provider]` | Unlink a sign-in method |
| `POST` | `/api/auth/signup`, `verify-code`, `resend-code` | Sign up and email verification |
| `POST` | `/api/auth/forgot-password`, `reset-password` | Password reset by code |
| `GET`, `POST` | `/api/auth/[...nextauth]` | NextAuth handlers |
| `GET` | `/api/resolve/[platform]` | Look up problem metadata |
| `POST` | `/api/leetcode/lookup` | Live LeetCode GraphQL lookup |
| `GET` | `/api/github/stars` | Cached star count for the repo button |

---

## Project structure

```text
dsarecx/
├── prisma/                   # Schema + migrations (dual-connection Neon config)
├── scripts/                  # Dataset generators (Codeforces, CodeChef, LeetCode)
├── src/
│   ├── app/
│   │   ├── (app)/            # Signed-in views: today, dashboard, daily, concepts, stats, settings
│   │   ├── (landing)/        # Public site
│   │   ├── api/              # Route handlers
│   │   └── auth/             # Login, signup, verify, reset
│   ├── auth.ts               # NextAuth config
│   ├── proxy.ts              # Route protection
│   ├── components/
│   ├── config/site.ts        # Branding
│   ├── data/                 # Offline problem datasets
│   └── lib/
│       ├── scheduling.ts     # The spaced-repetition engine (pure)
│       ├── dates.ts          # Time-zone-correct day boundaries
│       ├── prisma.ts         # Prisma client singleton
│       ├── platforms/        # Platform resolvers
│       ├── concepts/         # System design library and learning paths
│       └── ai/               # AI recall questions
```

---

## Getting started

```bash
git clone <your-fork-url> dsarecx
cd dsarecx
npm install
```

`.env`:

```env
DATABASE_URL="postgresql://user:password@endpoint-pooler.region.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@endpoint.region.neon.tech/neondb?sslmode=require"
AUTH_SECRET="generate with: openssl rand -base64 32"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
RESEND_API_KEY=""                 # verification and password-reset emails (codes are logged in dev without it)
EMAIL_FROM="dsarecx <noreply@your-domain>"   # optional; defaults to dsarecx <noreply@host of NEXT_PUBLIC_APP_URL>
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # public URL for metadata, sitemap and email links
NEXT_PUBLIC_GITHUB_REPO=""        # optional "owner/repo"; shows the GitHub star button
NEXT_PUBLIC_UMAMI_WEBSITE_ID=""   # optional Umami analytics site id
ANTHROPIC_API_KEY=""              # optional: AI-generated recall questions
```

```bash
npx prisma migrate deploy   # or: npm run db:push
npm run dev
```

Open [localhost:3000](http://localhost:3000). Run the unit tests with `npm test` and the end-to-end tests with `npm run test:e2e`.

### Local database (no Neon account needed)

`npm run db:local` starts a real PostgreSQL 17 server from `node_modules` and keeps its data in `.localdb/` (git-ignored). Leave it running in its own terminal, and point `.env` at it:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/dsarecx"
DIRECT_URL="postgresql://postgres:postgres@localhost:5433/dsarecx"
```

Then `npm run db:migrate` once, and `npm run dev`. Use Neon (above) for anything deployed.

### How the pages stay in sync

Problems, system design concepts, the to-learn list, the daily queue, streaks and stats all come from the same database rows (a concept is a `Problem` with platform `SYSTEM_DESIGN`). [`src/lib/data-sync.ts`](src/lib/data-sync.ts) makes every page agree: after any successful write to `/api/*`, every cached study-data response is reloaded from the server, in the current tab and in other open tabs (via `BroadcastChannel`), and a tab you come back to refreshes itself.

### Deploying

- Run `npx prisma migrate deploy`. If you use `prisma db push` instead, also run the SQL in `20261103120000_schedule_mastery_rechecks` once by hand. That migration only changes data.
- Set `RESEND_API_KEY`, `EMAIL_FROM` and `NEXT_PUBLIC_APP_URL`.
- Per-IP rate limits trust `x-forwarded-for`, which Vercel sets. On another host, make sure your proxy overwrites that header.

---

## Contributing

Bug reports, ideas and PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), and open an issue before a large PR.

## Maintainer

**Lakshman Revanth Reddy**, revanth3527@gmail.com

## License

GPL-3.0. See [LICENSE](LICENSE).
#   d s a r e c x  
 