# App API

JSON endpoints for the mobile app (`apps/mobile`), under `/api/v1` so the app can rely on them while the site changes. They read the same queries in `packages/db` as the site's pages.

| Endpoint | Returns |
| --- | --- |
| `GET /api/v1/listings?<filters>` | `{ listings, total, page, pageSize, gelPerUsd }`. Filters, `sort` and `page` are the site's results-page URL parameters (`packages/shared/src/search.ts`). `view=map` returns up to 200 listings that have a location, on one page. |
| `GET /api/v1/listings/<id>` | `{ listing, similar, gelPerUsd }`, or 404 `{ error: "notFound" }` for an unknown or unpublished listing. |
| `GET /api/listings/<id>/phone` | `{ phone }`: the existing counted, rate-limited reveal, shared with the site. |

Listings come without phone numbers (`contactPhone`, the broker's `phone`): the app asks for the number only when the person presses call or WhatsApp, as on the site. Filter options (deals, types, cities, districts) ship with the app from `packages/shared`, so they need no endpoint.

## Signed in

The app signs in with a phone code and keeps the session token in the phone's secure store. It sends it as `Authorization: Bearer <token>`, which every signed-in endpoint accepts in place of the site's cookie (`apps/web/src/lib/session.ts`), so posting and photo uploads use the site's own endpoints.

| Endpoint | Does |
| --- | --- |
| `POST /api/v1/auth/code` `{ phone }` | Sends the SMS code, with the site's limits. 400 `invalidPhone`, 429 `tooSoon`. |
| `POST /api/v1/auth/verify` `{ phone, code }` | `{ token, onboarded }`, or 401 `wrongCode`. |
| `POST /api/v1/auth/logout` | Ends the session. |
| `GET /api/v1/me` | `{ id, name, phone, role, onboarded, favoriteIds, unread }`; `unread` is the number of unread notifications, for the badge in the app's menu. |
| `POST /api/v1/onboarding` `{ name, intent, terms: true }` | The first-visit answers, which posting needs. |
| `GET /api/v1/favorites`, `PUT /api/v1/favorites/<id>` `{ favorite }` | The hearts. |
| `GET /api/v1/my-listings` | The user's listings, each with its `status`. |
| `POST /api/listings/photos`, `POST /api/listings` | The site's posting endpoints: one photo per request, then the form fields with the photo addresses. |
| `POST /api/v1/push` `{ token, platform, locale }`, `DELETE /api/v1/push` `{ token }` | Turns push on or off for this phone (an Expo push token). |
| `GET /api/v1/notifications?locale=<ka\|en\|ru>` | `{ notifications: [{ id, read, at, title, body }], unread }`, newest first, written as on the site's notifications page. |
| `POST /api/v1/notifications/<id>` `{ locale }` | Marks one read and answers `{ path }`, the site path it leads to (a saved search is opened, as on the site). 404 `notFound` for someone else's. |
| `POST /api/v1/notifications` | Marks them all read. |

Every signed-out call answers 401 `signedOut`.

## Push to the app

Each notification that goes to browsers also goes to the user's phones through Expo's push service (`apps/web/src/lib/app-push.ts`), with the site path it leads to in `data.url`, which the app opens as its own screen, and the notification's id in `data.tag`, which the app marks read with `POST /api/v1/notifications/<id>`. It needs no keys; set `EXPO_ACCESS_TOKEN` only if the Expo project turns on "enhanced push security". The settings switch for push covers both.
