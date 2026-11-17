# End-to-end tests

Playwright drives the built site in Chromium, on a wide screen (1280x800) and a phone (390x844, every page also checked at 360px). The tests live in `e2e/` and run in CI on every pull request (the `e2e` job in `.github/workflows/ci.yml`).

## What they check

- Every page they open: no page errors or console errors, nothing wider than the screen, and a visible main heading.
- Every route, signed out and signed in (user, broker, admin, a new account before onboarding).
- The main flows: search, a listing, the account pages, posting a listing through moderation, my listings.

Tests sign in without SMS: they create the user and a session straight in the database (`e2e/support/data.ts`) and set the session cookie. The app has no test-only way in.

## Run them locally

They use their own database, `mteam_e2e`, never `mteam` with your local data, and the local photo storage.

```sh
docker compose up -d postgres storage
docker compose up storage-init

# Once: the e2e database, with the demo listings
docker compose exec -T postgres psql -U mteam -c 'CREATE DATABASE mteam_e2e'
DATABASE_URL=postgresql://mteam:mteam@localhost:5432/mteam_e2e pnpm --filter @mteam/db db:deploy
DATABASE_URL=postgresql://mteam:mteam@localhost:5432/mteam_e2e pnpm --filter @mteam/db db:seed

# Once per machine: the browser
pnpm --filter @mteam/e2e exec playwright install chromium

pnpm e2e
```

`pnpm e2e` builds the site, starts it on port 3200 against `mteam_e2e` and runs every test. After a new migration, run `db:deploy` against `mteam_e2e` again.

- One project or file: `pnpm e2e --project=phone tests/search.spec.ts`. Without rebuilding: `pnpm --filter @mteam/e2e e2e ...`.
- A failed test leaves a screenshot and a trace in `e2e/test-results`: `pnpm --filter @mteam/e2e exec playwright show-trace <trace.zip>`. The HTML report is in `e2e/playwright-report`.
- On CI the report and traces of a failed run are attached to the run as the `playwright-report` artifact.
- The server runs without the AI, push and social sign-in keys, so the tests also check those features hide themselves.
