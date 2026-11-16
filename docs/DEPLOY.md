# Deploying to Vercel

The site runs on Vercel in the fixitge team, as the project `mteam`. Every merge into `main` deploys to production on its own; every pull request gets a preview.

## How a deploy runs

- Vercel builds `apps/web` (its Root Directory) with `scripts/vercel-build.sh`.
- On a production deploy, the script first runs the database migrations (`prisma migrate deploy`) over Neon's direct connection (`DATABASE_URL_UNPOOLED`), then builds. A failed migration stops the deploy, and the previous version stays live.
- Previews never migrate.

## Stage 1: private preview (now)

Only members of the fixitge team can open the site, through Vercel Authentication (Settings → Deployment Protection). There is no real SMS yet: `SMS_PROVIDER=log` writes each login code to the function logs (Vercel → the project → Logs, search `login code`).

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Where it comes from |
| --- | --- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Set by the Neon integration (Storage → Neon). |
| `LOGIN_CODE_SECRET` | `openssl rand -hex 32`. Never the example value. |
| `SMS_PROVIDER` | `log` during the private preview. |
| `EMAIL_PROVIDER` | `log` during the private preview: email confirmation and password reset links go to the function logs (search `[email]`). Without it the site refuses to send them. |
| `SITE_URL` | The site's address, e.g. `https://mteam.vercel.app`, later the real domain. |
| `STORAGE_ENDPOINT` | `https://<account id>.r2.cloudflarestorage.com` |
| `STORAGE_BUCKET` | The R2 bucket's name, e.g. `mteam-photos`. |
| `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | An R2 API token with Object Read & Write on that bucket. |
| `STORAGE_PUBLIC_URL` | The bucket's public address: its `r2.dev` URL, or a custom domain later. |
| `GOOGLE_*`, `FACEBOOK_*`, `APPLE_*` | Optional; see `SOCIAL_LOGIN.md`. Add the live return address at each provider. |
| `CRON_SECRET` | `openssl rand -hex 32`. Vercel Cron sends it to the nightly job; without it the job refuses every call. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional; push notifications to phones and computers. Run `npx web-push generate-vapid-keys` once and set the two keys it prints; `VAPID_SUBJECT` is a contact for the push services, e.g. `mailto:` and the team's address. Without them the settings page has no push section and nothing is sent. Keep the pair: a new one cuts off every device that turned push on, and their owners have to turn it on again. |
| `ANTHROPIC_API_KEY` | Optional; console.anthropic.com → API Keys. Without it the search assistant offers buttons only and the posting form has no "write the description with AI" button. Set a monthly spend limit in the Console; each address may send 30 typed questions an hour, and ask for 10 written descriptions an hour (20 per account). |

The secrets go only into Vercel, never into the code or chat.

## Nightly job

`apps/web/vercel.json` runs `/api/cron/nightly` at 21:00 UTC (01:00 in Tbilisi), after the National Bank publishes the next day's rate. It stores the lari rate, which reprices listings priced in lari, then recalculates market levels. Check it in Vercel → the project → Settings → Cron Jobs, where "Run" starts it by hand, and in Logs (search `nightly:`). A broken bank feed keeps the previous rate and shows the run as failed (502).

## Cloudflare R2

1. Cloudflare dashboard → R2 → create a bucket (`mteam-photos`, location Eastern Europe if offered). R2 asks for a payment card even on the free tier.
2. In the bucket's settings, turn on public access through the `r2.dev` subdomain. Its URL is `STORAGE_PUBLIC_URL`.
3. R2 → Manage API tokens → create a token with Object Read & Write, limited to that bucket. Its Access Key ID and Secret go into the two `STORAGE_` keys; the S3 endpoint shown there is `STORAGE_ENDPOINT`.

## Before opening to the public

The list in `PROJECT_BRIEF.md` ("Before public launch"), mainly a real SMS provider in place of `log` and the real domain.
