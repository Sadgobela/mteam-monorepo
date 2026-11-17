# App API

JSON endpoints for the mobile app (`apps/mobile`), under `/api/v1` so the app can rely on them while the site changes. They read the same queries in `packages/db` as the site's pages.

| Endpoint | Returns |
| --- | --- |
| `GET /api/v1/listings?<filters>` | `{ listings, total, page, pageSize, gelPerUsd }`. Filters, `sort` and `page` are the site's results-page URL parameters (`packages/shared/src/search.ts`). `view=map` returns up to 200 listings that have a location, on one page. |
| `GET /api/v1/listings/<id>` | `{ listing, similar, gelPerUsd }`, or 404 `{ error: "notFound" }` for an unknown or unpublished listing. |
| `GET /api/listings/<id>/phone` | `{ phone }`: the existing counted, rate-limited reveal, shared with the site. |

Listings come without phone numbers (`contactPhone`, the broker's `phone`): the app asks for the number only when the person presses call or WhatsApp, as on the site. Filter options (deals, types, cities, districts) ship with the app from `packages/shared`, so they need no endpoint.

Signing in, favourites and posting come in later steps.
