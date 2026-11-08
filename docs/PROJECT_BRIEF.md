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

**Phase 2:** mobile app (Expo, `apps/mobile`, same API), saved searches with notifications, paid VIP listings, an internal CRM for brokers, a Dubai section, importing listings from other sites.

## Decisions
- Web first, mobile later. The web version must also work well on phones.
- One monorepo (`mteam-monorepo`): pnpm + Turborepo. Next.js handles the site, admin and API. Split out `apps/api` only if load requires it.
- Stack: Next.js (TypeScript), PostgreSQL + Prisma, Cloudflare R2 for photos.
- Design: variant A from the mockup (light, search first, brand purple `#986DC6` from the logo as the accent), with both light and dark themes (follows the system setting, plus a manual toggle). Mockup: https://claude.ai/artifact/427T2eaNdjMvWsQz5jUhUh
- UI: familiar layout where people navigate, following what users know from myhome.ge and ss.ge, and a unique mTeam product where they decide. See `docs/UI_PLAN.md`. Their branding, assets and wording are never copied.
- Testing: tests from day one, with 100% coverage enforced.
- Working style: Irakli wants recommendations and alternative versions proposed proactively, and wants tokens kept low (agree on designs before building).

## Before public launch
Development runs entirely locally for now. These must be done before real users arrive:
- Real SMS provider (Georgia only; compare smsoffice.ge and others on price), plus a per-IP limit on code requests. Production refuses to issue codes until then.
- Cloudflare R2 instead of local SeaweedFS (R2 needs a payment method on the account; change the `STORAGE_` values).
- Strip photo metadata on upload: GPS in EXIF data would reveal where an owner took a photo.
- Direct-to-R2 uploads or proxy limits, so the 55 MB request limit is not open to anonymous visitors.
- Keyed hashing for login codes (`LOGIN_CODE_SECRET`).
- Moderation panel: new listings stay hidden until then.
- A real exchange rate: search, sorting and the ₾/$ switch use fixed rates.
