# MTeam mobile app

Expo (SDK 58) with Expo Router, for iOS and Android. It talks to the site's API (`docs/MOBILE_API.md`) and shares its types, search rules and ka / en / ru copy through `packages/shared`.

## What it does

- **Menu**: a frosted-glass bar floating over every screen (`src/components/TabBar.tsx`), drawn by the root layout rather than the tabs, so it stays on a listing too. Posting is the raised button in the middle; notifications carry the unread count.
- **Search**: deal, type, city, price and rooms, sorting, and results a page at a time. A saved search opened from a notification or the saved list arrives as the screen's query.
- **Listing**: photos to swipe with a counter, price, facts, description in the app's language, call and WhatsApp (the number is asked for at the press, as on the site), writing to the seller, the broker's card (opens their page) or the owner's other listings, a loan calculator for a sale, similar listings.
- **Favourites**, once signed in.
- **My listings**: a tab for each status with its count, each listing with its views, number reveals, hearts and chats, and open, edit, move up, renew, take down or delete a draft, as on the site. The list is read again whenever it comes back into view.
- **Posting and editing**: the fields every listing needs and photos from the gallery (`src/components/ListingForm.tsx`). Editing fills the same form from `GET /api/v1/my-listings/<id>` and sends back every field it got, so details only the site shows are kept; only new photos are uploaded. The site's posting endpoints check everything again.
- **Brokers**: MTeam's branches and brokers, a broker's page with call, WhatsApp, bio and listings, a branch's page, and a private seller's page.
- **Mortgage** and **prices**: the loan calculator on its own, and the typical price per m² by district and room count for a city, for sale or rent.
- **Profile** and **settings**: name, photo and what brings the user here; the notification and privacy switches, and deleting the account (not for brokers and admins).
- **Notifications**: the site's notifications list; opening one marks it read and goes to its screen. A tapped push does the same, also when it started the app.
- **Messages**: the chats (from the account menu or the icon over search), and a chat with bubbles by day, a box that rises with the keyboard, and new messages every 10 seconds while it is open. "Write" on a listing starts one; the menu steps aside in a chat for its box.
- **Saved searches**: "Save search" over the results keeps their filters (not their order); the list shows each one's new listings, opens it on the search tab, and removes it. At the limit, saving opens the list.
- **Account**: sign-in with an SMS code, first-visit questions, a menu of my listings, messages, saved searches, profile and settings, push on this phone, a menu of brokers, mortgage and prices for everyone, app language, sign-out.
- **Site links**: a notification's site path opens the app's own screen when it has one (`routeForPath` in `src/lib/format.ts`), and the site's page in the browser otherwise.
- **Loader**: the site's logo loader (`src/components/Brand.tsx`). The splash image (`assets/splash-mark.png`, white mark and word on the brand colour) is the first frame of the start-up screen, which then moves until the session is known.
- Light and dark themes follow the phone, with the site's colour tokens.

## Running it

```bash
pnpm install
pnpm --filter @mteam/mobile start      # then open it in Expo Go or a development build
```

By default the app talks to `extra.apiUrl` in `app.json` (production, `https://mteam-phi.vercel.app`). To use a local site, start `apps/web` and set its address, reachable from the phone:

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
