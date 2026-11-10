# Work plan

Written 2026-11-10 for one unattended working block of 4 to 5 hours. Going live stays last (see the "Before public launch" list in `PROJECT_BRIEF.md`).

Each stage is its own pull request: tests and build pass, the pages are looked at in light, dark and phone, Alpa reviews it, then it is merged. If a stage needs a decision only Irakli can make, the safest default is taken and listed under "For Irakli" at the end.

## Stages

- [x] **1. Finish search (about 75 minutes).** A row of filter buttons above the results, as Georgian portals have. Price per m². Owners only. Building status. Tbilisi metro stations. Finding a listing by its ID.
- [x] **2. Cards and listing page on Ant Design (about 60 minutes).** Page numbers, swiping through photos on a card, correct "1 photo" wording, listing page and photo viewer polish.
- [x] **3. Forms on Ant Design (about 60 minutes).** Posting a listing with searchable city, district and street, photo upload, sign in, leaving a number. Fields that fit the property type.
- [x] **4. Account pages on Ant Design (about 30 minutes).** My listings, favourites, brokers, admin.
- [x] **5. Full look at every page (about 30 minutes).** Every page in Georgian, English and Russian, light and dark, desktop and phone. Fix what looks wrong.
- [x] **6. Morning report.** What changed, what was left, what needs a decision.

## Not in this block

Anything that needs an account, money or an outside service: real SMS, real storage, hosting, paid VIP, mortgage partners, developer projects. Real market prices need more listings than we have.

## For Irakli

- A loading skeleton was tried and removed: as a route boundary it hid the header and turned removed listings into soft 404s. It needs a Suspense split of the home page if it is wanted.
- Photos are stored at full size. Resizing them on upload would make cards load faster.
- Place names in English and Russian are spelled letter by letter, so some read oddly ("Dzveli Batumis Ubani").
