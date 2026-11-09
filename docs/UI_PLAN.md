# mTeam UI plan

mTeam is its own product, not another portal. The rule: **familiar where people navigate, unmistakably mTeam where they decide.** Someone used to myhome.ge or ss.ge should know how to search without thinking, and should see at once why this site can be trusted more.

Update the checkboxes as work lands. Agree on a visual before building each large item (see `docs/PROJECT_BRIEF.md`).

## What we follow and what we don't

**Follow (common portal conventions):** where things sit on the page, what a card shows and in what order, how filters and results work.

**Do not copy:** logos, brand colours (myhome green, ss blue), icons and illustrations, photos, wording, or any of their code. Everything is drawn and written for mTeam, using the tokens in `globals.css`.

**Keep mTeam's own:** brand purple `#986DC6`, light and dark themes, and the two things that set us apart:
- **mTeam Verified** takes the most prominent badge position on a photo, where the portals show paid VIP labels.
- **Give it to mTeam** is a visible entry point on the home page.

## What makes mTeam unique

These come first in every design decision. Where a portal convention conflicts with one of them, this list wins.

- **Trust is visible.** A verified listing says who checked it and when, not only that it was checked.
- **"Verified only" sits in the main search**, not buried in the extra filters.
- **Results lead with verified listings.** No banner ads and no paid placement in version 1, so the page stays calm where the portals are crowded.
- **A real person on the listing.** The broker's name, photo and branch appear on the card and listing page.
- **Give it to mTeam is a main action** for owners: on the home page and on listing pages, with the promises stated plainly (commission is paid only by the owner; a tenant within one year or half the fee back).
- **Its own look.** Purple accent, generous spacing and our own icons, photography treatment and typography. Screenshots should never be mistaken for another site.

## What users are used to (observed 2026-11-09)

| Area | myhome.ge | ss.ge |
|---|---|---|
| Header | Logo, post button, language, search, favourites, messages, sign in; a second row of sections | Logo, category tabs, post button, messages, sign in, language |
| Search | One wide bar: deal and property type, location, ID or street, filter icon, search button | A row of dropdowns: deal, property, location, price, area, then search |
| Results | Count, grid / list / map switch, owner and agency checkboxes, sort | Count, sort, list / grid switch |
| Card | Photo with badge and heart, price with ₾/$ switch, price per m², generated title, icon row (area, floor, rooms, bedrooms), address, date | Large photo on the left, title, price, address with metro, short description, icon row, date |

| Dropdowns (seen again 2026-11-09) | The deal and type field opens one panel of pill choices; extra filters open a large panel with pills and from/to ranges; a row of filter pills sits above results | Each field opens its own popover with clear and apply; location is a full-screen picker with popular cities and an A to Z list |

## Moving to Ant Design

Agreed on 2026-11-09. Each stage is merged on its own.

- [x] Stage 1: foundation, search bar and filters panel, phone menu, sliding switches for sort, view and currency, hover and fade motion
- [ ] Stage 2: listing cards, listing page, photo viewer
- [ ] Stage 3: forms (posting, sign in, leaving a number)
- [ ] Stage 4: my listings, favourites, brokers, admin

Locations and deal types follow what Georgian portals offer (checked on myhome.ge, 2026-11-09): five deal types and 126 cities and municipalities with their districts, kept in `packages/shared/src/geo.ts`. Streets (about 2,750) are not in the list; the address stays free text. In English and Russian, place names are spelled out letter by letter from Georgian.

Since stage 1 the search bar and the sort, view and currency switches need JavaScript. Listings, cards and paging are still plain links.

## Plan

Chosen on 2026-11-09: **version A, the familiar grid**, from the [clickable mockup](https://claude.ai/artifact/LG6CuHAfL58Qu8KoT8agxS). Results keep a list view as the second option.

### 1. Header
- [x] Two rows on desktop: logo, post button, language, favourites, sign in; then the sections.
- [x] Compact phone header with a menu.

### 2. Search
- [x] Home: one wide bar with deal and property type, location, and search.
- [x] "Verified only" switch beside the search button.
- [x] A filters button opening price, rooms and city.
- [x] Area in the panel; district through the location text.
- [x] Floor filter.
- [x] Results: the same bar stays at the top.
- [x] Active filters as removable chips.

### 3. Listing card
- [x] Order: photo, price, price per m², generated title, icon row, address, date.
- [x] Generated title in the page language, such as "For sale: 3-room apartment in Vake", so the card is not only in the language the owner wrote.
- [x] mTeam Verified badge top left and photo count.
- [x] Favourite heart top right.
- [x] Broker and check date on hover.
- [x] Broker avatar and name on cards.
- [x] Four columns on desktop, two on tablet, one on phone.

### 4. Results
- [x] Separate results view with listing count and sort (newest, price up, price down).
- [x] Grid / list switch.
- [x] Pagination.
- [x] Map view.

### 5. Listing page
- [x] Full-width gallery with a photo viewer.
- [x] Sticky contact box: call, WhatsApp, and the broker's face and branch.
- [x] Price and ₾/$ switch in that box.
- [x] Verification note: what was checked, by whom and when.
- [x] "Give it to mTeam" for owners.
- [x] Working call and WhatsApp buttons.
- [x] Facts as an icon grid.

### 6. Posting form
- [x] Photo preview before sending, and an optional map pin.
- [x] Split into steps.

## Needs backend work

These UI items need more than styling:

- [x] Sort options and pagination in `searchListings`.
- [x] Area filter.
- [x] ₾/$ price display, at fixed rates.
- [ ] A real exchange rate source.
- [x] Favourites.
- [x] Verified filter and verified-first ordering.
- [x] Who verified a listing and when (`verifiedAt`, `verifiedBy`).
- [x] Lead form for Give it to mTeam.
- [x] Generated titles need translated district names, or fall back to the city.

## Order

All items above are done except a real exchange rate source, which is on the pre-launch list in `docs/PROJECT_BRIEF.md`.
