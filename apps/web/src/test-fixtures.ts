import type { Listing } from "@mteam/shared";

const agent = { id: "a1", name: "ნინო ბერიძე", branch: "ვაკის ფილიალი", phone: "+995 5XX XX XX XX" };

/** Listings for component and page tests. */
export const fixtureListings: Listing[] = [
  { id: 20418, deal: "sale", type: "apartment", title: "3-ოთახიანი ბინა ვაკეში, პარკის ხედით", city: "თბილისი", district: "ვაკე", address: "ჭავჭავაძის გამზ. 37", price: 148000, currency: "USD", area: 92, rooms: 3, floor: 7, floors: 12, condition: "ახალი რემონტი", description: "მზიანი ბინა.", verified: true, agent, images: [], tone: "violet", updatedAt: "2026-11-06" },
  { id: 20422, deal: "rent", type: "apartment", title: "2-ოთახიანი ბინა საბურთალოზე", city: "თბილისი", district: "საბურთალო", address: "ვაჟა-ფშაველას გამზ. 12", price: 900, currency: "USD", area: 64, rooms: 2, floor: 9, floors: 16, description: "ავეჯით და ტექნიკით.", verified: false, images: [], tone: "sand", updatedAt: "2026-11-07" },
  { id: 20440, deal: "sale", type: "apartment", title: "1 საძინებელი Dubai Marina-ში", city: "დუბაი", district: "Dubai Marina", address: "Marina Walk", price: 1450000, currency: "AED", area: 78, rooms: 2, description: "ავეჯით.", verified: true, agent, images: [], tone: "rose", updatedAt: "2026-11-04" },
];
