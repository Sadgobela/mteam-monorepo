# mTeam platform: project brief

Decisions agreed with Irakli on 2026-11-08. Keep this file current when a decision changes.

## The company
- M Team (MTeam Brokers, facebook.com/Mgroup.ge, instagram MTeam.Brokers): real estate intermediary agency.
- Founded around 2020, about 70 staff. Two branches in Tbilisi and one in Dubai (the first Georgian agency in the UAE). Batumi listings too.
- Business model: commission is charged only to the property owner, never the client. Rentals come with a guarantee: a tenant within one year, or half the fee back.
- Note: the mgroup.ge website belongs to an unrelated hospitality company. It is not mTeam's site.

## Goal
Today mTeam posts its listings on existing portals (ss.ge, myhome.ge style). We are building mTeam's own listings platform under the mTeam brand:
- mTeam brokers post listings, and other people (owners, private sellers) can post too.
- Trust is the edge over the big portals. A broker who has checked a listing on site marks it **mTeam Verified** (photos, area and price confirmed).
- **"Give it to mTeam"**: an owner can hand a property to mTeam to sell or rent. This becomes a lead for the company (`Lead` model).

## Scope
**Version 1 (web):** search with filters (sale / rent / daily, type, city and district, price, area, rooms) plus a map; a listing page with gallery and call / WhatsApp buttons; sign-up with a phone code; posting a listing, "my listings", favourites; broker profiles; an admin panel for moderation; ka / en / ru.

**Phase 2:** mobile app (Expo, `apps/mobile`, same API), saved searches with notifications, paid VIP listings, an internal CRM for brokers, importing listings from other sites.

## Decisions
- Web first, mobile later. The web version must also work well on phones.
- One monorepo (`mteam-monorepo`): pnpm + Turborepo. Next.js handles the site, admin and API. Split out `apps/api` only if load requires it.
- Stack: Next.js (TypeScript), PostgreSQL + Prisma, Cloudflare R2 for photos.
- Design: variant A from the mockup (light, search first, brand purple `#986DC6` from the logo as the accent), with both light and dark themes (follows the system setting, plus a manual toggle). Mockup: https://claude.ai/artifact/427T2eaNdjMvWsQz5jUhUh
- The name is written **MTeam** on the site, as in the logo.
- Logo: the designer's official files, purple `#986DC6` on light backgrounds and white on dark or purple ones. The site draws it from those vectors in `apps/web/src/components/Logo.tsx`.
- UI: familiar layout where people navigate, following what users know from myhome.ge and ss.ge, and a unique mTeam product where they decide. See `docs/UI_PLAN.md`. Their branding, assets and wording are never copied.
- Testing: tests from day one, with 100% coverage enforced.
- Market: the site serves Georgia only. The Dubai section and AED prices were removed on 2026-11-09 at Irakli's request.
- UI library: Ant Design 6 for interactive controls (dropdowns, panels, switches, forms), themed with MTeam's colours so it never looks like a default admin panel. Chosen by Irakli on 2026-11-09.
- Working style: Irakli wants recommendations and alternative versions proposed proactively, and wants tokens kept low (agree on designs before building).

## Before public launch
Development runs entirely locally for now. These must be done before real users arrive:
- Real SMS provider (Georgia only; compare smsoffice.ge and others on price). Production refuses to issue codes until then.
- Cloudflare R2 instead of local SeaweedFS (R2 needs a payment method on the account; change the `STORAGE_` values). If uploads ever go straight to R2, photos still need a server step that removes their metadata.
- Set `LOGIN_CODE_SECRET` to the output of `openssl rand -hex 32`, never the example value.
- Hosting: the proxy in front of the site must add the visitor's address as the last `x-forwarded-for` entry, because the limit on login codes trusts only that entry. It must also allow 55 MB requests to `/api/listings`.
- A map tile provider: the free OpenStreetMap tile server is for development only.
- A real exchange rate: search, sorting and the ₾/$ switch use fixed rates.
- Set `SITE_URL` to the real address, or the sitemap and page links will point at localhost.
- Run `db:market` every night, so market levels follow new listings.
