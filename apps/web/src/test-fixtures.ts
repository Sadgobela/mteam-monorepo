import type { Listing } from "@mteam/shared";

const agent = { id: "a1", name: "ნინო ბერიძე", branch: "ვაკის ფილიალი", phone: "+995 5XX XX XX XX" };

/** Listings for component and page tests. */
export const fixtureListings: Listing[] = [
  { sellerId: "seller1", specs: {}, features: [], id: 20418, deal: "sale", type: "apartment", title: "3-ოთახიანი ბინა ვაკეში, პარკის ხედით", city: "თბილისი", district: "ვაკე", address: "ჭავჭავაძის გამზ. 37", price: 148000, currency: "USD", area: 92, rooms: 3, floor: 7, floors: 12, description: "მზიანი ბინა.", verified: true, agent, contactPhone: "+995555000000", images: [], tone: "violet", updatedAt: "2026-11-06" },
  { sellerId: "seller1", specs: {}, features: [], id: 20422, deal: "rent", type: "apartment", title: "2-ოთახიანი ბინა საბურთალოზე", city: "თბილისი", district: "საბურთალო", address: "ვაჟა-ფშაველას გამზ. 12", price: 900, currency: "USD", area: 64, rooms: 2, floor: 9, floors: 16, description: "ავეჯით და ტექნიკით.", verified: false, contactPhone: "+995555000000", images: [], tone: "sand", updatedAt: "2026-11-07" },
  { sellerId: "seller1", specs: {}, features: [], id: 20440, deal: "sale", type: "apartment", title: "ბინა ძველ ბათუმში", city: "ბათუმი", district: "ძველი ბათუმის უბანი", address: "მემედ აბაშიძის გამზ. 20", price: 270000, currency: "GEL", area: 78, rooms: 2, description: "ავეჯით.", verified: true, agent, contactPhone: "+995555000000", images: [], tone: "rose", updatedAt: "2026-11-04" },
];
