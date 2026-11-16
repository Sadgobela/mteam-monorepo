# Accounts plan: from phone sign-in to a full account

Agreed with Irakli on 2026-11-16. Built in parallel tracks on top of one foundation branch.

## What myhome.ge has (seen signed in, 2026-11-16)

We follow the layout people know and never copy their wording, branding or images.

- **Account area:** a left sidebar (my listings, my company, messages, cards and transactions, profile, sign out) under a header card with name, user id and balance.
- **My listings:** status tabs with counts (current, draft, unpaid, disabled, blocked, expired, expiring soon), search by id, phone or word, sort, currency switch, a free-listing limit (0/3), and a notice about the agent-status rule (7 active listings, or joining a company).
- **Profile:** first and last name, gender, birth year, personal id number, email, phone, behind an "edit profile" button.
- **My company:** register a company, or join one as an agent.
- **Cards and transactions:** saved cards, balance top-up, a filterable history of paid services.
- **Posting form:** one long page with a step list on the left and a live preview card. Cadastral code (optional, hidden from the site, "raises trust"), total or per-m² price, "exchange possible", an AI price estimate, rooms 1–10+, all the detail groups we already have, description in three languages with AI writing, up to 16 photos, upload from a phone by QR code, "hide my number" (chat only), cross-posting to a sister site, then paid boosts: Super VIP, VIP+, VIP, colour, auto-renew, Facebook boost, stickers. Save as draft or publish.
- **Header when signed in:** add, language and currency, favourites, search, messages, account menu (my listings, top up, profile, sign out).

## What we have

Phone-code sign-in with Google, Facebook and Apple; my listings (archive only, no edit); favourites; saved searches; messages; admin; a three-step posting form. An account is created silently at first sign-in, with no name, and there is no profile, settings, notifications, listing edit, expiry or statistics.

## Decisions

- **Registration:** email and password join the phone code, Google, Facebook and Apple. Passwords are hashed with scrypt; email links (verify, reset) go through an `EMAIL_PROVIDER` that writes to the log until a real provider is chosen, like `SMS_PROVIDER`. After the first sign-in, whichever way, a short onboarding asks for a name, what brings you here (looking, owner, broker) and acceptance of the terms. Posting still needs a verified phone, since it is the listing's contact.
- **We do not collect** gender, birth year or personal id numbers. They are not needed for anything we do.
- **Email and SMS delivery wait for a provider.** Notifications are in-app now; the preferences are stored so delivery can be switched on later.
- **Paid services wait for a payment provider** (VIP, bumps for money, balance). Free bump once a day is in.
- **Brokers join by invite link** from the admin, not by an activity rule.
- **Expiry:** owners' listings end after 60 days unless renewed with one click; brokers' listings never expire.
- **Editing a published listing:** a text or photo change goes back to moderation; a price-only change does not.
- **Merging:** each green pull request in this series is merged without asking again (Irakli, 2026-11-16).

## Our own additions

- **Listing quality score with hints** while posting: what is missing and how much it would help (photos, description length, details, cadastral code).
- **Price hint from our own market data** on the form: where the asking price sits against the district, using the stored market medians.
- **AI description in Georgian, English and Russian** from the filled fields, with the same quota and safety as the search assistant.
- **Owner statistics:** views, phone reveals, favourites and messages per listing, and the listing's market position.
- **Price-drop alerts** on favourites, and new matches for saved searches, as notifications.
- **"Ask MTeam to verify"** on an owner's listing, which creates a lead for a broker visit (the trust edge from the brief).
- **Hide my number:** buyers can only write through chat.

## Foundation (one branch, before the tracks)

Done in `feat/account-foundation`. Besides the list below it adds, so tracks never edit the same lines: one copy file per namespace in `packages/shared/src/copy/` (already wired into `i18n.ts`), one module per track in `packages/db/src/` (already exported from `index.ts`), and the two nightly steps already called from `/api/cron/nightly`.


1. **Schema, one migration** for every track, so tracks never write migrations:
   - `User`: `email` (unique), `emailVerifiedAt`, `passwordHash`, `avatarUrl`, `intent` (`SEEKING` | `OWNER` | `BROKER`), `onboardedAt`, `termsAcceptedAt`, `notifyMessages`, `notifySavedSearches`, `notifyPriceDrops`, `notifyListingUpdates` (all `true`), `hidePhoneDefault` (`false`).
   - `Listing`: `expiresAt`, `bumpedAt`, `phoneReveals` (0), `hidePhone` (false), `cadastralCode`, `descriptionEn`, `descriptionRu`.
   - `Session`: `userAgent`, `lastSeenAt`.
   - `Agent`: `bio`.
   - New `Notification` (user, type, optional listing and conversation, JSON data, `readAt`, `createdAt`).
   - New `ListingPriceChange` (listing, old and new dollar price, `createdAt`).
   - New `AgentInvite` (token hash, optional branch, creator, `expiresAt`, `usedAt`, used by).
   - New `EmailToken` (token hash, user, purpose `VERIFY` or `RESET`, email, `expiresAt`, `usedAt`).
   - Owners' published listings get `expiresAt` 60 days from the migration.
2. **Account shell:** a `(account)` route group whose layout draws the sidebar around my listings, favourites, saved searches, messages and the new profile, settings and notifications pages. URLs do not change.
3. **Header:** the account menu points into the shell.

## Tracks (in parallel, each in its own worktree and branch)

Each track owns the files listed; anything else is changed only as described. Copy goes into `packages/shared/src/i18n.ts` in the track's own namespace, in all three languages. Styles go into a CSS file of the track's own, imported where used. Tests keep coverage at 100%.

| Track | Builds | Owns |
| --- | --- | --- |
| **A. Onboarding and profile** | Onboarding after the first sign-in (redirect until done); profile page: name, avatar upload, email, change phone by SMS code, linked Google, Facebook and Apple; name and avatar on the seller page and in chat. | `account/profile`, `onboarding`, `db/src/profile.ts`, `i18n` namespace `profile` |
| **B. Settings and privacy** | Notification preferences, hide-my-number default, signed-in devices with sign-out of the others (record user agent and last seen), delete my account (listings archived, personal data removed, sessions ended). | `account/settings`, `db/src/settings.ts`, session recording in `session.ts`, namespace `settings` |
| **C. My listings** | Status tabs with counts (active, pending, draft, expiring soon, archived, rejected), search and sort, per-listing statistics (views, phone reveals, favourites, messages, market level), free bump once per 24 hours (sorts by `bumpedAt`), expiry after 60 days with renew; the nightly job archives expired listings; phone reveals counted. | `my-listings`, `db/src/my-listings.ts`, the expiry step in the nightly job, namespace `myListings` |
| **D. Notifications** | Bell with unread count in the header; notifications page; mark as read; created on a new message, approval or rejection, a listing expiring in 3 days, a price drop on a favourite (from `ListingPriceChange`), new matches for a saved search (nightly); each respects the user's preferences. | `account/notifications`, `db/src/notifications.ts`, the bell in `Header.tsx`, the notify step in the nightly job, namespace `notifications` |
| **G. Email and password** | Register with email and password, sign in with them, verify the email by link, forgot and reset password, set or change a password from the profile; per-address and per-email attempt limits; links through `EMAIL_PROVIDER` (`log` for now). | `db/src/password.ts`, the email tab of the sign-in panel, `auth/verify`, `auth/reset`, namespace `auth` |
| **E. Posting and editing** | Edit a listing (text or photo changes go back to moderation, a price-only change does not and is recorded in `ListingPriceChange`); a step list with live preview; autosaved draft; quality score with hints; market price hint; AI description in three languages; cadastral code; hide my number, enforced on the server (the phone route and what a listing page sends); up to 16 photos with reordering. Done in two passes: first editing, the price record, the moderation rule and the new fields; then the form experience. | `ListingForm.tsx`, `listings/new`, `listings/[id]/edit`, `db/src/listings.ts` write paths, namespace `post` |
| **F. Brokers** | Admin creates invite links (optional branch); opening one after sign-in makes the user a broker; broker profile edit (photo, bio); "ask MTeam to verify" on an owner's listing creates a lead. | `admin/brokers`, `invite/[token]`, `db/src/invites.ts`, namespace `brokersAdmin` |

## Order of merging

Foundation first. Then each track as its own pull request in this order, rebased on the one before: E, C, G, A, B, F, D. D last because it hooks into code the others touch.

## Later, with providers

Email and SMS delivery of notifications; paid boosts and balance; upload from a phone by QR code; cross-posting.
