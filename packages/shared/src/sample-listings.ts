import type { Listing } from "./types";

/** Example data for the UI until the database is connected. Not real listings. */
const nino = { id: "a1", name: "ნინო ბერიძე", branch: "ვაკის ფილიალი", phone: "+995 5XX XX XX XX" };

export const sampleListings: Listing[] = [
  { id: 20418, deal: "sale", type: "apartment", title: "3-ოთახიანი ბინა ვაკეში, პარკის ხედით", city: "თბილისი", district: "ვაკე", address: "ჭავჭავაძის გამზ. 37", price: 148000, currency: "USD", area: 92, rooms: 3, floor: 7, floors: 12, condition: "ახალი რემონტი", description: "ბინა მზიან მხარეს არის, ორი აივნით და ცენტრალური გათბობით. სახლი 2019 წლისაა, აქვს მიწისქვეშა პარკინგი.", verified: true, agent: nino, tone: "violet", updatedAt: "2026-11-06" },
  { id: 20422, deal: "rent", type: "apartment", title: "2-ოთახიანი ბინა საბურთალოზე", city: "თბილისი", district: "საბურთალო", address: "ვაჟა-ფშაველას გამზ. 12", price: 900, currency: "USD", area: 64, rooms: 2, floor: 9, floors: 16, description: "ავეჯით და ტექნიკით, მეტროსთან ახლოს.", verified: false, tone: "sand", updatedAt: "2026-11-07" },
  { id: 20431, deal: "sale", type: "apartment", title: "ბინა ბათუმში, ზღვის ხედით", city: "ბათუმი", district: "ახალი ბულვარი", address: "შერიფ ხიმშიაშვილის ქ. 5", price: 96500, currency: "USD", area: 58, rooms: 2, floor: 21, floors: 35, description: "ზღვის ხედი, თეთრი კარკასი.", verified: true, agent: nino, tone: "steel", updatedAt: "2026-11-05" },
  { id: 20440, deal: "sale", type: "apartment", title: "1 საძინებელი Dubai Marina-ში", city: "დუბაი", district: "Dubai Marina", address: "Marina Walk", price: 1450000, currency: "AED", area: 78, rooms: 2, description: "ავეჯით, აუზით და სპორტული დარბაზით.", verified: true, agent: nino, tone: "rose", updatedAt: "2026-11-04" },
];

export function getListing(id: number): Listing | undefined {
  return sampleListings.find((l) => l.id === id);
}
