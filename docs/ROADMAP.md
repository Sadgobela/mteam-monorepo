# Roadmap: what is still missing compared with myhome.ge

Checked on 2026-11-10 by going through myhome.ge's public pages without signing in. Going live stays last (see "Before public launch" in `PROJECT_BRIEF.md`). As in `UI_PLAN.md`, we follow what users already know and never copy branding, photos or wording.

Not seen, because it needs an account: their posting form, chat, profile and notifications.

Worth knowing: MTeam already has a page on myhome.ge with 16,349 listings and 85 agents. Those are MTeam's own listings, so they are the natural first content for this site.

## What is missing

### Listing details (they also power the filters)

| Field | myhome has | We have |
|---|---|---|
| Condition | 8 fixed values: newly renovated, old renovated, under renovation, needs renovation, white / black / green frame, white plus | Free text, not in the posting form |
| Rooms | Up to 10+ | Up to 4+ in search |
| Bedrooms, bathrooms | Yes, bathrooms 1, 2, 3+, shared | No |
| Floor filters | Last, not last, not first | From and to only |
| Year built, ceiling height, project type | Yes | No |
| Heating, hot water, parking | 7, 8 and 6 options | No |
| Building material, windows, storage | 5, 3 and 8 options | No |
| Balcony, living room with area | Yes | No |
| Building features | Lift, freight lift, gym, pools, sauna, concierge, security, alarm and more | No |
| Furniture and appliances | 10 items | No |
| Utilities | Internet, TV, gas, water, sewage, electricity, phone, fireplace | No |
| Tags | Door code, Airbnb or Booking account, investment, exchange possible | No |

### Search

| Feature | We have |
|---|---|
| All the fields above as filters | No |
| Price and price per m² in ₾ or $ | $ only |
| Construction company checkbox | Owners only, in the panel |
| Market price filter | No |
| Saved searches | No |
| Hide a listing from results | No |
| A larger third card layout | Grid, list and map |
| Pages for search engines by city and type, with a sitemap | No |

### Listing page

| Feature | We have |
|---|---|
| Thumbnails under the main photo | Tiles and a viewer |
| Share, hide | Favourite only |
| Phone hidden until pressed | Always shown |
| Report a listing | No |
| The owner's other listings | Brokers only |
| Similar listings | No |
| Price compared with the market, on a five-step scale | No |
| Loan calculator and monthly estimate | No |
| Chat with the seller | No |

### Whole sections

| Section | What it does | We have |
|---|---|---|
| Agencies | Searchable directory; agency page with its agents | Brokers only |
| New projects | 104 developer projects with filters, units, prices, handover date, what is nearby | No |
| Price statistics | Average prices by district and room count | No |
| Mortgage | Calculator and loan request | No |
| Contract templates | Sale, rental, deposit and more to download | No |
| Valuation, photo service | Sent to a partner site | No |
| Paid S-VIP placement | Top of results | No, by design so far |

Steps 1 to 7 below are built, and step 8 as far as it can go without partners. Project types are incomplete: only the six visible on their list, plus "other".

Step 3: the import tool is ready (`docs/IMPORT.md`). It is waiting for the export and photos from the brokers, and its columns may need mapping once a real export is seen.

## Suggested order

1. **Listing details and full filters.** Needs nothing from outside, and everything later builds on it.
2. **Listing page.** Hidden phone, report, share, similar listings, thumbnails, loan calculator.
3. **Real content.** Import MTeam's own listings. Needs an Excel export and photos from the brokers.
4. **Agencies.** Agency pages with their agents, starting with MTeam's branches.
5. **Market price and statistics.** Works once real listings are in, because it is calculated from them.
6. **Search engines.** Pages by city and type, sitemap.
7. **Accounts.** Saved searches, notifications, chat.
8. **Sections that need partners.** Developer projects, mortgage with a bank, contract templates written by a lawyer, paid placement with a payment provider.
9. **Go live.**

## What is waiting, and on whom

- **MTeam:** the brokers' export and photos (step 3), and the list of branches and who works where (step 4).
  The listings now on myhome.ge and ss.ge come in the same way, as an export from MTeam or from those sites on MTeam's request, not copied off their pages: both sites forbid it to bots, and their photos carry the sites' logos.
- **A paid sending service:** SMS or email alerts for saved searches and new messages (step 7).
- **Partners:** developer projects, loan requests with a bank, contract templates written by a lawyer, paid placement with a payment provider (step 8).
- **Launch:** the list in `PROJECT_BRIEF.md`.
