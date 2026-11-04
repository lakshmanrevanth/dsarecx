# Contributing to dsarecx

Thanks for considering a contribution. dsarecx is built by one person and actively maintained, and real contributions are welcome.

## Before you start

For anything bigger than a small fix (a typo, a small bug, a style tweak), **open an issue first**. Say what you want to change and why, so you don't spend time on a PR that doesn't fit. For small fixes, open the PR directly.

## Ways to contribute

- **Bug reports.** Include steps to reproduce, what you expected and what happened. Screenshots help.
- **Feature ideas.** Describe the use case, not just the feature: "I'm trying to do Y and can't" is more useful than "I want X".
- **Code.** See the setup below.
- **A new platform resolver.** See the guide below. It is self-contained and one of the most useful contributions.
- **Docs.** Clearer explanations, examples, README fixes.

## Development setup

```bash
git clone <your-fork-url> dsarecx
cd dsarecx
npm install
```

You need a Neon Postgres database for local development (the free tier is fine):

```env
DATABASE_URL="your-pooled-neon-connection-string"
DATABASE_URL_UNPOOLED="your-direct-neon-connection-string"
AUTH_SECRET="generate with: openssl rand -base64 32"
```

GitHub sign-in is optional locally, because email + password sign-in works without them. Without `RESEND_API_KEY`, verification codes are printed to the dev server log.

```bash
npx prisma db push
npm run dev
npm test
```

Run `npm test` and `npm run typecheck` before opening a PR. The scheduling engine (`src/lib/scheduling.ts`) is fully covered by tests, and any change to it must keep them passing.

> [!NOTE]
> **Prisma engine files.** Don't force-kill `prisma generate` or a build partway through. Interrupted runs can leave `query_engine-*.dll.node.tmp*` files in `node_modules/.prisma/client/`, and serverless bundlers pick them up, which bloats deployments. If you suspect stale engines, delete any `.tmp*` files there.

## Project structure

```
src/
├── app/            # App Router pages and API route handlers
├── components/     # React components, grouped by feature
├── config/site.ts  # Product name, tagline and URLs: the single source of branding
├── lib/
│   ├── scheduling.ts   # The spaced-repetition engine: pure functions, fully tested
│   ├── dates.ts        # Day boundaries in the user's time zone
│   ├── prisma.ts       # Prisma client singleton: import it, never create PrismaClient elsewhere
│   └── platforms/      # One resolver per coding platform
└── data/           # Offline problem datasets (JSON), rebuilt by scripts/
```

## Adding a platform resolver

Every platform implements the same interface:

```typescript
// src/lib/platforms/types.ts
export interface PlatformResolver {
  resolve(identifier: string): Promise<ResolveResult>;
}
```

To add one:

1. Create `src/lib/platforms/your-platform.ts` implementing `PlatformResolver`.
2. If you have a dataset, add it under `src/data/` (and ideally a generator in `scripts/`), then load it in your resolver.
3. Register the resolver in `src/lib/platforms/index.ts`.
4. Add the platform to the `Platform` enum in `prisma/schema.prisma` and create a migration.
5. Add its logo in `src/lib/platforms/logos.tsx`.
6. Write tests, following `src/lib/platforms/leetcode.test.ts`.

The scheduling engine, UI and API don't need to know anything else about your platform.

## Code style

- TypeScript everywhere. Avoid `any` unless you really need it.
- Keep `src/lib/scheduling.ts` pure: no database calls and no side effects. Testability depends on it.
- Never hard-code the product name. Use `siteConfig` from `src/config/site.ts`.
- Any new date logic should use the helpers in `src/lib/dates.ts`, so day boundaries follow the user's time zone.
- Follow the conventions of the file you're editing.
- Keep each PR to one thing, with no unrelated refactors.

## Pull requests

1. Fork the repo and branch off `main` (`feature/…` or `fix/…`).
2. Keep commits scoped and messages clear.
3. Run `npm test`, `npm run typecheck` and `npm run lint`.
4. Open a PR that says what changed, why, and how you tested it.
5. Reviews can take a few days, since one person maintains the project.

## Questions

Open an issue, or use the contact details in the README.
