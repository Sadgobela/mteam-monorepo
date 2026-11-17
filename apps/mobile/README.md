# MTeam mobile app

Expo (SDK 58) with Expo Router, for iOS and Android. It talks to the site's API (`docs/MOBILE_API.md`) and shares its types, search rules and ka / en / ru copy through `packages/shared`.

## What it does

- **Search** (tab 1): deal, type, city, price and rooms, with results a page at a time.
- **Listing**: photos to swipe, price and facts, description in the app's language, call and WhatsApp (the number is asked for at the press, as on the site), similar listings.
- **Favourites** (tab 2) and **my listings**, once signed in.
- **Posting** (tab 3): the fields every listing needs and photos from the gallery. The site's posting endpoints check everything again.
- **Account** (tab 4): sign-in with an SMS code, first-visit questions, push on this phone, app language, sign-out.
- Light and dark themes follow the phone, with the site's colour tokens.

## Running it

```bash
pnpm install
pnpm --filter @mteam/mobile start      # then open it in Expo Go or a development build
```

By default the app talks to `extra.apiUrl` in `app.json` (the Vercel preview). To use a local site, start `apps/web` and set its address, reachable from the phone:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.5:3000 pnpm --filter @mteam/mobile start
```

The site is open only to the team (Vercel Authentication on every deployment, and Vercel cannot exempt one path). The app gets through with the project's "Protection Bypass for Automation" key, sent as the `x-vercel-protection-bypass` header. Put it in `apps/mobile/.env.local`, which git ignores, never in `app.json`:

```bash
EXPO_PUBLIC_VERCEL_BYPASS=<the key from Vercel → Settings → Deployment Protection>
```

It is built into the app, so only team builds may carry it, and it opens the whole site, not just the API. Drop it once the site is public.

## Push notifications

Expo push tokens need an EAS project: run `npx eas-cli@latest init` once in `apps/mobile`, which adds `extra.eas.projectId` to the config. Until then the push switch says notifications are unavailable. Push needs a real phone and, on Android, a development or store build (Expo Go no longer receives remote push on Android).

## Checks

```bash
pnpm --filter @mteam/mobile typecheck
pnpm --filter @mteam/mobile lint
pnpm --filter @mteam/mobile test       # Jest (jest-expo), 100% coverage enforced
```

Screen tests live in `src/screens.test/`, outside `src/app/`, because every file under `src/app/` is a route.
