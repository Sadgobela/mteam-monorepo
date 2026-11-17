# App API

JSON endpoints for the mobile app (`apps/mobile`), under `/api/v1` so the app can rely on them while the site changes. They read the same queries in `packages/db` as the site's pages.

| Endpoint | Returns |
| --- | --- |
| `GET /api/v1/listings?<filters>` | `{ listings, total, page, pageSize, gelPerUsd }`. Filters, `sort` and `page` are the site's results-page URL parameters (`packages/shared/src/search.ts`). `view=map` returns up to 200 listings that have a location, on one page. |
| `GET /api/v1/listings/<id>` | `{ listing, similar, sellerCount, gelPerUsd }`, or 404 `{ error: "notFound" }` for an unknown or unpublished listing. `sellerCount` is how many listings an owner has live (0 for a broker's), as the site links to the seller's page when there is more than one. |
| `GET /api/listings/<id>/phone` | `{ phone }`: the existing counted, rate-limited reveal, shared with the site. |
| `GET /api/v1/brokers` | `{ branches: [{ id, name, city, brokerCount, listingCount }], brokers: [{ id, name, branch, listingCount }] }`, as on the site's brokers page. |
| `GET /api/v1/brokers/<id>` | `{ broker: { id, name, branch, phone, photoUrl, bio }, listings, gelPerUsd }`. A broker's number is public, as on the site. 404 `notFound`. |
| `GET /api/v1/branches/<id>` | `{ branch: { id, name, city }, brokers, listings, gelPerUsd }`. 404 `notFound`. |
| `GET /api/v1/sellers/<id>` | `{ seller: { name, avatarUrl }, listings, gelPerUsd }`. 404 `notFound` for someone with nothing live. |
| `GET /api/v1/prices?city=<city>&deal=<sale\|rent>` | `{ city, deal, stats: [{ district, rooms, median }] }`: the typical apartment price per m² in USD by district and room count (4 means four or more), as on the site's prices page. Tbilisi sales without filters. |

Listings come without phone numbers (`contactPhone`, the broker's `phone`): the app asks for the number only when the person presses call or WhatsApp, as on the site. Filter options (deals, types, cities, districts) ship with the app from `packages/shared`, so they need no endpoint.

## Signed in

The app signs in with a phone code and keeps the session token in the phone's secure store. It sends it as `Authorization: Bearer <token>`, which every signed-in endpoint accepts in place of the site's cookie (`apps/web/src/lib/session.ts`), so posting and photo uploads use the site's own endpoints.

| Endpoint | Does |
| --- | --- |
| `POST /api/v1/auth/code` `{ phone }` | Sends the SMS code, with the site's limits. 400 `invalidPhone`, 429 `tooSoon`. |
| `POST /api/v1/auth/verify` `{ phone, code }` | `{ token, onboarded }`, or 401 `wrongCode`. |
| `POST /api/v1/auth/logout` | Ends the session. |
| `GET /api/v1/me` | `{ id, name, phone, role, agentId, onboarded, favoriteIds, unread }`; `unread` is the number of unread notifications, for the badge in the app's menu, and `agentId` the broker the user is, or null. |
| `POST /api/v1/onboarding` `{ name, intent, terms: true }` | The first-visit answers, which posting needs. |
| `GET /api/v1/favorites`, `PUT /api/v1/favorites/<id>` `{ favorite }` | The hearts. |
| `GET /api/v1/profile`, `PUT /api/v1/profile` `{ name, intent }` | `{ name, avatarUrl, intent, createdAt }`, and saving the name and what brings them here. 422 `invalid`. |
| `POST /api/v1/profile/avatar` | A new profile photo (multipart `photo`, up to 4 MB), answered with `{ avatarUrl }`. 422 `invalid`, 429 `tooMany`. |
| `GET /api/v1/settings`, `PUT /api/v1/settings` `{ key, value }` | `{ preferences, canDelete }`: the notification and privacy switches of the site's settings page, one saved at a time. 400 `invalid`. |
| `DELETE /api/v1/account` `{ confirm: "yes" }` | Deletes the account for good, with its sessions and push tokens. 403 `staff` for brokers and admins, as on the site. |
| `GET /api/v1/my-listings?tab=<tab>` | `{ tab, counts, listings, gelPerUsd }`: one tab of the user's listings (`active`, `pending`, `draft`, `expiring`, `archived`, `rejected`), how many each tab holds, and for each listing its `status`, `views`, `phoneReveals`, `favorites`, `conversations`, `canRenew`, `canBump`, `expiresAt` and `nextBumpAt`. Without a tab, the first one with something in it. |
| `GET /api/v1/my-listings/<id>` | `{ id, status, fields, images }`: one of the user's listings as the posting form's values, every field by name, for editing. 404 `notFound`. |
| `DELETE /api/v1/my-listings/<id>` | Deletes an unfinished draft. 404 `notFound` for anything else. |
| `POST /api/v1/my-listings/<id>/<bump\|renew\|archive>` | Moves a listing up, renews it for 60 days, or takes it down, with the site's rules. 409 `failed` when that is not possible now. |
| `POST /api/listings/photos`, `POST /api/listings` | The site's posting endpoints: one photo per request, then the form fields with the photo addresses. With an `id` among the fields it saves an edit of the user's own listing; the app sends back every field it was given, so details it does not show are kept. |
| `POST /api/v1/push` `{ token, platform, locale }`, `DELETE /api/v1/push` `{ token }` | Turns push on or off for this phone (an Expo push token). |
| `GET /api/v1/notifications?locale=<ka\|en\|ru>` | `{ notifications: [{ id, read, at, title, body }], unread }`, newest first, written as on the site's notifications page. |
| `POST /api/v1/notifications/<id>` `{ locale }` | Marks one read and answers `{ path }`, the site path it leads to (a saved search is opened, as on the site). 404 `notFound` for someone else's. |
| `POST /api/v1/notifications` | Marks them all read. |
| `GET /api/v1/conversations` | `{ conversations: [{ id, listingId, listingTitle, otherName, lastBody, lastAt, unread }] }`, the latest first. |
| `POST /api/v1/conversations` `{ listingId, body }` | Writes to a listing's seller, in the chat they already have or a new one, and answers `{ id }`. 400 `invalid`, 422 `failed` (their own listing, one no longer published, or too many messages lately). |
| `GET /api/v1/conversations/<id>` | `{ id, listingId, listingTitle, otherName, messages: [{ id, body, mine, at }] }`, oldest first; reading it marks it read. 404 `notFound` unless the user is in it. The app asks again every 10 seconds while a chat is open. |
| `POST /api/v1/conversations/<id>` `{ body }` | Sends a message. 400 `invalid`, 422 `failed`. |
| `GET /api/v1/saved-searches?locale=<ka\|en\|ru>` | `{ searches: [{ id, query, name, others, newCount }] }`: the filters as a query string, a name from deal, type and city, how many other filters it has, and listings new since it was last opened. |
| `POST /api/v1/saved-searches` `{ query }` | Saves the filters of a search, kept in the site's form, and answers `{ query }`. 400 `invalid`, 409 `limit` when the user has as many as allowed. |
| `POST /api/v1/saved-searches/<id>/open` | Counts its listings as seen and answers `{ query }`, which the app opens on the search tab. 404 `notFound`. |
| `DELETE /api/v1/saved-searches/<id>` | Removes one. |

Every signed-out call answers 401 `signedOut`.

## Push to the app

Each notification that goes to browsers also goes to the user's phones through Expo's push service (`apps/web/src/lib/app-push.ts`), with the site path it leads to in `data.url`, which the app opens as its own screen, and the notification's id in `data.tag`, which the app marks read with `POST /api/v1/notifications/<id>`. It needs no keys; set `EXPO_ACCESS_TOKEN` only if the Expo project turns on "enhanced push security". The settings switch for push covers both.
