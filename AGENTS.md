# AGENTS.md

## Cursor Cloud specific instructions

This is a single Next.js 14 (App Router) app — "Kodu Project Controls AI". Stack: Prisma 6 + PostgreSQL, NextAuth (credentials), Tailwind + shadcn/ui. See `README.md` for the module overview and `package.json` for scripts.

### Services & how to run them

- **Web app (Next.js)**: `npm run dev` → http://localhost:3000. This is the only application process.
- **PostgreSQL**: a local Postgres 16 cluster backs the app in this environment. It does **not** auto-start on boot — start it each session before running the app or Prisma commands:
  ```bash
  sudo pg_ctlcluster 16 main start
  ```
  Connection (already set in `.env`): `postgresql://postgres:postgres@localhost:5432/kodu`.

### Environment / gotchas

- **`.env` is required and gitignored.** It is already present in this environment (local DB URL, a generated `NEXTAUTH_SECRET`, `NEXTAUTH_URL=http://localhost:3000`, and `CHROME_PATH=/usr/local/bin/google-chrome`). If it is ever missing, recreate it from `.env.example` pointing `DATABASE_URL`/`DIRECT_URL` at the local `kodu` database.
- **Dependencies need `--legacy-peer-deps`.** There is no lockfile and `eslint@9` conflicts with `@typescript-eslint/*@7` / `eslint-config-next`, so a plain `npm install` fails with ERESOLVE. Always `npm install --legacy-peer-deps`.
- **`npm run lint` (`next lint`) does not work** with the installed `eslint@9` + Next 14.2 (Next passes removed ESLint options). There is also no committed ESLint config. Linting is not part of a working setup here; note that `next.config.js` sets `eslint.ignoreDuringBuilds: true`, so this does not block builds.
- **Auth is enforced** by `middleware.ts` on `/dashboard`, `/projects`, `/cors` and several `/api/*` routes; unauthenticated requests 307-redirect to `/login`.

### Database setup / seed

- Apply schema: `npm run db:push` (uses `prisma db push`, needs Postgres running).
- Seed sample data: `npx prisma db seed`. Seeding is idempotent (upserts) and guarded by `scripts/safe-seed.ts` (aborts if `scripts/seed.ts` contains delete calls — do not add deletes there).
- **Seeded login:** `john@doe.com` / `johndoe123` (role admin). Use it for manual testing.

### Optional / not configured here

AI (`ANTHROPIC_API_KEY`), server-side PDF export (Puppeteer via `CHROME_PATH`), and file storage (AWS S3 / Azure / Supabase) are feature-specific and require external credentials that are not set. Core flows (auth, projects, CORs, pay-apps, RFIs, budgets, schedules CRUD) work without them; only those specific endpoints fail. Note the app is a partial migration from Abacus — some AI/PDF/notification routes still reference removed Abacus services (see `README.md` / `MIGRATION_PROMPTS.md`).
