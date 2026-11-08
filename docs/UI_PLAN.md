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

## Plan

Recommended base: myhome's page structure and grid, with ss's list view as the second option on results.

### 1. Header
- [ ] Two rows on desktop: logo, post button, language, favourites, sign in; then the sections.
- [ ] Compact phone header with a menu.

### 2. Search
- [ ] Home: one wide bar with deal and property type, location, and search.
- [ ] "Verified only" switch beside the search button.
- [ ] A filters button opening the full set: price, area, rooms, floor, city and district.
- [ ] Results: the same bar stays at the top, with active filters as removable chips.

### 3. Listing card
- [ ] Order: photo, price, price per m², generated title, icon row, address, date.
- [ ] Generated title in the page language, such as "For sale: 3-room apartment in Vake", so the card is not only in the language the owner wrote.
- [ ] mTeam Verified badge top left, with broker and check date on hover and on the listing page; favourite heart top right; photo count.
- [ ] Broker avatar and name on verified cards.
- [ ] Four columns on desktop, two on tablet, one on phone.

### 4. Results
- [ ] Separate results view with listing count and sort (newest, price up, price down).
- [ ] Grid / list switch.
- [ ] Pagination.
- [ ] Map view (later).

### 5. Listing page
- [ ] Full-width gallery with a photo viewer.
- [ ] Sticky price and contact box: price, ₾/$ switch, call, WhatsApp, and the broker's face and branch.
- [ ] A verification panel: what was checked, by whom and when.
- [ ] "Give it to mTeam" for owners.
- [ ] Working call and WhatsApp buttons.
- [ ] Facts as an icon grid.

### 6. Posting form
- [ ] Steps: type, location, details, photos, with a photo preview before sending.

## Needs backend work

These UI items need more than styling:

- [ ] Sort options and pagination in `searchListings`.
- [ ] District and area filters.
- [ ] ₾/$ price display (exchange rate source; search currently uses a fixed rate).
- [ ] Favourites.
- [ ] Who verified a listing and when (`verifiedAt`, `verifiedBy`), and a verified filter with verified-first ordering.
- [ ] Lead form for Give it to mTeam (the `Lead` model already exists).
- [ ] Generated titles need translated district names, or fall back to the city.

## Order

1 card, 2 search and header, 3 results, 4 listing page, 5 posting form. The card comes first because it appears on every browsing page and is what users compare with the portals.
