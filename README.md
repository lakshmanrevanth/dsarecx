<div align="center">

<img src="public/icon-192.png" alt="dsarecx logo" width="88" height="88" />

# dsarecx

### Solve it once. Recall it for *good.*

Spaced repetition for DSA problems and system design concepts.<br />
dsarecx brings back everything you learn on day 3, 7, 14 and 30, right before you would forget it.

[**Open the app →**](https://dsarecx.vercel.app) &nbsp;·&nbsp; [Report a bug](https://github.com/lakshmanrevanth/dsarecx/issues/new) &nbsp;·&nbsp; [Request a feature](https://github.com/lakshmanrevanth/dsarecx/issues/new)

[![Live](https://img.shields.io/badge/live-dsarecx.vercel.app-ff6a1f?style=flat-square)](https://dsarecx.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Postgres on Neon](https://img.shields.io/badge/Postgres-Neon-00E599?style=flat-square&logo=postgresql&logoColor=white)](https://neon.tech/)
[![Tests](https://img.shields.io/badge/tests-488%20passing-2ea44f?style=flat-square)](#running-the-tests)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

<br />

<img src="docs/screenshots/landing.png" alt="dsarecx landing page" width="100%" />

</div>

---

## Why dsarecx

You solve *Course Schedule* in March. By the interview in May, it's gone. Re-solving everything from scratch doesn't scale, and a spreadsheet of "problems to revisit" never gets opened.

dsarecx is a revision planner built on the forgetting curve. Log a problem or concept once; it comes back for review at growing intervals, and each review adjusts the next date to how well you actually remembered it. All you do is open **Today**, review what's due, and log what you learned.

- **Free and open source** (MIT), no ads, no paid tier.
- **5 coding platforms**: LeetCode, Codeforces, GeeksforGeeks, HackerRank and CodeChef, with titles and difficulty filled in from **18,000+ indexed problems**.
- **System design** too: 58 core concepts and 7 ordered learning paths (66 articles).
- **No notifications.** Nothing pings you; your queue is waiting when you open the app.

---

## A tour

### Today: what you learned, what's due, what's next

The home screen after sign-in. Everything you logged today, split into DSA and system design; how many reviews are due, with one button to start; and a **to-learn list** for what you plan to study next. Paste a LeetCode link and the title, difficulty and topic fill themselves in. Press **Learned it** and the item joins your review schedule.

<img src="docs/screenshots/today.png" alt="Today page: learned today, revise today, and the to-learn list" width="100%" />

### Daily review: recall first, then rate

Each due item asks you to recall the approach before you peek at your notes. Then rate it **Clean**, **Shaky** or **Struggled**; every button shows exactly when the item will come back. Weakest and overdue items come first.

<img src="docs/screenshots/daily.png" alt="Daily review with recall, notes and rating steps" width="100%" />

### Focus mode: one card at a time, keyboard only

Press <kbd>F</kbd> for a distraction-free deck. <kbd>Space</kbd> reveals notes, <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> rate, <kbd>S</kbd> snoozes, <kbd>U</kbd> undoes, <kbd>?</kbd> lists every shortcut.

<img src="docs/screenshots/focus.png" alt="Focus mode review card" width="100%" />

### Dashboard: every problem in one editable table

A Notion-style tracker: click any cell to edit, add rows inline, create your own columns (text, select, date, checkbox, link), group and filter by platform, topic, tag or list (Blind 75, NeetCode 150…), and bulk-edit with one click. Imports CSV, Excel and full JSON backups.

<img src="docs/screenshots/dashboard.png" alt="Dashboard problem table" width="100%" />

### System design: learning paths, in order

Seven reading paths from beginner fundamentals to senior-level HLD and LLD. Mark an article learned and it enters the same review schedule as your coding problems, with recall questions to answer from memory. Or log any concept from the built-in library.

<img src="docs/screenshots/concepts.png" alt="System design learning paths with progress" width="100%" />

### Stats: memory, measured

Clean-recall rate by week, upcoming reviews, where each item sits on the ladder, and the topics that need another pass. Plus a 365-day activity heatmap and your streak.

<img src="docs/screenshots/stats.png" alt="Stats page with recall rate and upcoming reviews charts" width="100%" />

### Dark mode

Light, dark, or follow your system.

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/dashboard-dark.png" alt="Dashboard in dark mode" /></td>
    <td width="50%"><img src="docs/screenshots/daily-dark.png" alt="Daily review in dark mode" /></td>
  </tr>
</table>

### On your phone

Every screen works at phone width, and dsarecx installs as an app from the browser menu.

<table>
  <tr>
    <td width="25%"><img src="docs/screenshots/mobile-landing.png" alt="Landing page on a phone" /></td>
    <td width="25%"><img src="docs/screenshots/mobile-today.png" alt="Today page on a phone" /></td>
    <td width="25%"><img src="docs/screenshots/mobile-daily.png" alt="Daily review on a phone" /></td>
    <td width="25%"><img src="docs/screenshots/mobile-dashboard.png" alt="Dashboard on a phone" /></td>
  </tr>
</table>

<details>
<summary><b>More screens</b>: sign-in, settings, landing in dark mode</summary>
<br />

<img src="docs/screenshots/login.png" alt="Sign-in page" width="100%" />
<img src="docs/screenshots/settings.png" alt="Settings page" width="100%" />
<img src="docs/screenshots/landing-dark.png" alt="Landing page in dark mode" width="100%" />

</details>

---

## How the scheduling works

Every problem and concept climbs a 4-step ladder. The default intervals are **3 → 7 → 14 → 30 days**, and you can change all four in Settings.

| Your rating | What happens next |
|---|---|
| **Clean** | Moves up one step. Clean at the last step means **mastered**: it leaves the queue and comes back once after 90 days as a recheck. |
| **Shaky** | Repeats the same interval. |
| **Struggled** | Back to the first step. |

- Overdue items never disappear; the next date counts from the day you actually reviewed.
- Every "day" is *your* day, in your own time zone.
- One rating per item per day; today's rating can be changed or undone.

The engine is a set of pure, fully unit-tested functions in [`src/lib/scheduling.ts`](src/lib/scheduling.ts).

---

## All features

| | |
|---|---|
| **Today** | Learned today (DSA / system design), due count, to-learn list with target dates, reorder, "Learned it" |
| **Daily review** | Recall → reveal → rate, focus mode, keyboard shortcuts, snooze 1d/3d/1w, retire, undo, daily goal |
| **Problem tracker** | Inline editing, autosave, custom columns, tags, named lists, filters and group-by kept in the URL, bulk actions with undo |
| **Platforms** | LeetCode (with live lookup fallback), Codeforces (with live fallback), CodeChef, GeeksforGeeks, HackerRank |
| **System design** | 58-concept library in 10 categories, 7 ordered learning paths, recall questions for each |
| **AI recall questions** | Optional: Claude writes recall questions for any problem or concept (needs `ANTHROPIC_API_KEY`) |
| **Progress** | Streaks (optionally goal-based), 365-day heatmap, recall-rate and ladder charts, weak topics |
| **Your data** | Full JSON backup and restore (skip / merge / overwrite), formula-safe CSV export, CSV and Excel import |
| **Accounts** | Email + password with 6-digit email codes, or GitHub sign-in; change email or password; delete account |
| **Security** | Rate-limited auth, code lockout after 5 tries, no account enumeration, safe redirects, sessions end on password change |
| **Everywhere** | Light / dark / system theme, installable app, works on phones, keyboard accessible, reduced-motion aware |

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, React 19, Server Components + Route Handlers) |
| Language | TypeScript 5 |
| Database | PostgreSQL on [Neon](https://neon.tech/), via [Prisma 6](https://www.prisma.io/) |
| Auth | [Auth.js / NextAuth v5](https://authjs.dev/): email + password and GitHub |
| Email | Gmail SMTP (no domain needed) or [Resend](https://resend.com/) |
| UI | Tailwind CSS 4, Instrument Serif + Geist, lucide icons, Motion |
| Data | SWR, with a sync layer that keeps every page and tab up to date |
| Testing | Vitest (488 tests), Playwright end-to-end |
| Hosting | [Vercel](https://vercel.com/) |

---

## Getting started

You need **Node.js 20+**. No database account is required to try it locally.

```bash
git clone https://github.com/lakshmanrevanth/dsarecx.git
cd dsarecx
npm install
cp .env.example .env
```

**1. Start a local database** (a real PostgreSQL that runs from `node_modules`; data is kept in `.localdb/`). Leave it running:

```bash
npm run db:local
```

**2. Point `.env` at it** and add a secret:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/dsarecx"
DATABASE_URL_UNPOOLED="postgresql://postgres:postgres@localhost:5433/dsarecx"
AUTH_SECRET="any long random string"
```

**3. Create the tables and run the app:**

```bash
npm run db:migrate
npm run dev
```

Open [localhost:3000](http://localhost:3000) and create an account. Without an email provider, sign-up codes are printed in the terminal running `npm run dev`.

### Running the tests

```bash
npm test            # unit tests (Vitest)
npm run test:e2e    # end-to-end tests (Playwright)
npm run typecheck
```

---

## Deploying (Vercel + Neon)

1. **Database:** create a project on [Neon](https://neon.tech/) and copy both connection strings. Run the migrations once against it:
   ```bash
   DATABASE_URL="<pooled>" DATABASE_URL_UNPOOLED="<direct>" npx prisma migrate deploy
   ```
2. **App:** import the repo on [Vercel](https://vercel.com/new) and set the environment variables below. Set the function region to the one closest to your database (for example Singapore, `sin1`, for a Neon project in `ap-southeast-1`).
3. **Sign-in:** create a GitHub OAuth app with the callback URL `https://<your-site>/api/auth/callback/github`.
4. **Email codes:** either a Gmail account with an [app password](https://myaccount.google.com/apppasswords) (`SMTP_USER` + `SMTP_PASS`), or a Resend key with a verified domain.
5. Redeploy after changing any variable.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon **pooled** connection string (host contains `-pooler`); used by the running app. Add `&connect_timeout=15` so a sleeping database has time to wake up. |
| `DATABASE_URL_UNPOOLED` | yes | Neon **direct** connection string; used only for migrations |
| `AUTH_SECRET` | yes | Random secret for sessions: `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | yes | Your site's public URL, used in emails, metadata and the sitemap |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | for GitHub sign-in | From your GitHub OAuth app |
| `SMTP_USER`, `SMTP_PASS` | for email codes (option A) | Gmail address and its 16-character app password |
| `RESEND_API_KEY`, `EMAIL_FROM` | for email codes (option B) | Resend key and a sender on a domain verified in Resend |
| `ANTHROPIC_API_KEY` | optional | AI-generated recall questions |
| `NEXT_PUBLIC_GITHUB_REPO` | optional | `owner/repo` for the source links and star button; defaults to this repository |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | optional | Umami analytics |

<details>
<summary><b>Why two database URLs?</b> (Neon + serverless notes)</summary>
<br />

Vercel runs many function instances at once. If each opened its own direct Postgres connection, Neon's connection limit would be hit under load, with `too many connections` errors that never show up locally. So:

- **`DATABASE_URL`** goes through Neon's PgBouncer pooler and is used for every query the app makes.
- **`DATABASE_URL_UNPOOLED`** is direct and is used only by `prisma migrate`, because PgBouncer's transaction mode doesn't support some statements migrations need.

[`src/lib/prisma.ts`](src/lib/prisma.ts) keeps a single Prisma client per process. Prisma is pinned to 6.19.3 on purpose: Prisma 7 moves the datasource config into `prisma.config.ts` and breaks this two-URL setup.

</details>

<details>
<summary><b>How the pages stay in sync</b></summary>
<br />

Problems, concepts, the to-learn list, the daily queue, streaks and stats all come from the same rows (a concept is a `Problem` with platform `SYSTEM_DESIGN`). [`src/lib/data-sync.ts`](src/lib/data-sync.ts) reloads every cached view after any successful change, in the current tab and in other open tabs (via `BroadcastChannel`), and refreshes a tab you come back to.

</details>

<details>
<summary><b>Database schema</b></summary>
<br />

| Model | Purpose |
|---|---|
| `User` | Account, hashed password, preferences (time zone, daily goal, intervals, streak mode) |
| `Account`, `Session`, `VerificationToken` | Auth.js sign-in data and email codes |
| `Problem` | Platform, code, ladder step (0–3), status (`ACTIVE` / `MASTERED` / `RETIRED`), next review, tags, notes, recall questions, custom fields (JSON). System design concepts use platform `SYSTEM_DESIGN`. |
| `Revision` | Every review: rating, type, step before and after |
| `StudyItem` | The to-learn list |
| `ProblemList` | Named lists (Blind 75, NeetCode 150, …) |
| `UserColumnConfig` | Each user's custom column definitions |
| `StreakLog` | Daily completion log |
| `RateLimit` | Counters for auth rate limits |

See [`prisma/schema.prisma`](prisma/schema.prisma).

</details>

<details>
<summary><b>API reference</b></summary>
<br />

All routes except `auth/*` and `github/stars` need a signed-in session.

| Method | Endpoint | Description |
|---|---|---|
| `GET`, `POST`, `DELETE` | `/api/problems` | List with filters; create (metadata resolved automatically); delete several |
| `PATCH`, `DELETE` | `/api/problems/[id]` | Update fields (status or solve-date changes reschedule); delete |
| `PATCH` | `/api/problems/[id]/revise` | Submit a rating (`409` if already rated today) |
| `PATCH` | `/api/problems/[id]/revise-again` | Bring a mastered problem back as a recheck |
| `PATCH` | `/api/problems/[id]/retire` | Retire a problem |
| `POST` | `/api/problems/[id]/snooze` | Snooze 1, 3 or 7 days |
| `POST` | `/api/problems/[id]/undo-revision` | Undo today's rating |
| `PATCH` | `/api/problems/[id]/custom-fields` | Update custom fields atomically |
| `POST`, `PUT` | `/api/problems/[id]/questions` | Generate (AI) or save recall questions |
| `POST` | `/api/problems/bulk` | Bulk status, delete or list action in one transaction |
| `GET` | `/api/problems/due` | Due and overdue items |
| `GET` | `/api/problems/revised-today` | Items rated today |
| `POST` | `/api/problems/import` | Import rows or a JSON backup (skip / merge / overwrite) |
| `GET`, `POST` | `/api/concepts` | System design library and path progress; log a concept (path order enforced) |
| `GET`, `POST`, `PATCH` | `/api/study` | To-learn list; add; reorder |
| `PATCH`, `DELETE` | `/api/study/[id]` | Edit or delete a to-learn item |
| `GET` | `/api/today` | Today page data in one request |
| `GET` | `/api/daily/summary` | Daily review data in one request |
| `GET` | `/api/stats`, `/api/streak`, `/api/activity` | Statistics, streak, 365-day activity |
| `GET`, `POST`, `DELETE` | `/api/columns` | Custom column definitions |
| `PATCH`, `DELETE` | `/api/columns/[id]` | Rename, retype, reorder or delete a column |
| `GET`, `POST` | `/api/lists` | Named lists |
| `PATCH`, `DELETE` | `/api/lists/[id]` | Rename or delete a list |
| `POST` | `/api/lists/[id]/problems` | Add or remove problems |
| `GET`, `POST` | `/api/export` | JSON backup or formula-safe CSV |
| `GET`, `PATCH` | `/api/settings` | Preferences |
| `GET`, `DELETE` | `/api/account` | Account info; delete the account |
| `POST` | `/api/account/password`, `/api/account/email`, `/api/account/email/verify` | Change password or email |
| `DELETE` | `/api/account/providers/[provider]` | Unlink a sign-in method |
| `POST` | `/api/auth/signup`, `verify-code`, `resend-code`, `forgot-password`, `reset-password` | Sign-up, email codes, password reset |
| `GET`, `POST` | `/api/auth/[...nextauth]` | Auth.js handlers |
| `GET` | `/api/resolve/[platform]` | Look up problem metadata |
| `POST` | `/api/leetcode/lookup` | Live LeetCode lookup |
| `GET` | `/api/github/stars` | Cached star count |

</details>

<details>
<summary><b>Project structure</b></summary>
<br />

```text
dsarecx/
├── prisma/                 schema and migrations
├── public/                 icons and the install manifest
├── scripts/                local database, icons, README screenshots, dataset generators
├── docs/screenshots/       images used in this README
└── src/
    ├── app/
    │   ├── (app)/          signed-in pages: today, dashboard, daily, concepts, stats, settings
    │   ├── (landing)/      public site: home, about, contact, privacy, terms
    │   ├── api/            route handlers
    │   └── auth/           sign-in, sign-up, verify, reset
    ├── components/         UI, grouped by page
    ├── config/site.ts      name, tagline, contacts
    ├── data/               offline problem datasets
    └── lib/
        ├── scheduling.ts   the spaced-repetition engine (pure)
        ├── dates.ts        time-zone-correct day boundaries
        ├── data-sync.ts    keeps every page and tab in sync
        ├── platforms/      platform lookups
        ├── concepts/       system design library and learning paths
        └── ai/             AI recall questions
```

The README screenshots are generated by [`scripts/readme-screenshots.mjs`](scripts/readme-screenshots.mjs) from a demo account on a local database.

</details>

---

## Contributing

Bug reports, ideas and pull requests are welcome. Please [open an issue](https://github.com/lakshmanrevanth/dsarecx/issues/new) before a large change, and see [CONTRIBUTING.md](CONTRIBUTING.md).

## Author

**Lakshman Revanth Reddy** · [GitHub @lakshmanrevanth](https://github.com/lakshmanrevanth) · [revanth3527@gmail.com](mailto:revanth3527@gmail.com)

If dsarecx helps your interview prep, a ⭐ on the repo helps others find it.

## License

[MIT](LICENSE) © 2026 Lakshman Revanth Reddy.

The system design learning paths link to articles from [Vidya](https://www.vidya-bodha.com/paths) by @Harry_The_Nerd. Only their titles, one-line summaries and links are included; the articles belong to their author.
