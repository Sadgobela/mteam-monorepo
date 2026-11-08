import type { Prisma, PrismaClient } from "@prisma/client";

type DemoListing = Omit<Prisma.ListingUncheckedCreateInput, "ownerId" | "agentId" | "status"> & { brokered: boolean };

/** Demo data for local development and CI. Not real listings, never run this against production. */
const demoListings: DemoListing[] = [
  { id: 20418, deal: "SALE", type: "APARTMENT", title: "3-ოთახიანი ბინა ვაკეში, პარკის ხედით", city: "თბილისი", district: "ვაკე", address: "ჭავჭავაძის გამზ. 37", lat: 41.7095, lng: 44.7606, price: 148000, priceUsd: 148000, currency: "USD", area: 92, rooms: 3, floor: 7, floors: 12, condition: "ახალი რემონტი", description: "ბინა მზიან მხარეს არის, ორი აივნით და ცენტრალური გათბობით. სახლი 2019 წლისაა, აქვს მიწისქვეშა პარკინგი.", verified: true, brokered: true, updatedAt: new Date("2026-11-06") },
  { id: 20422, deal: "RENT", type: "APARTMENT", title: "2-ოთახიანი ბინა საბურთალოზე", city: "თბილისი", district: "საბურთალო", address: "ვაჟა-ფშაველას გამზ. 12", lat: 41.7255, lng: 44.7539, price: 900, priceUsd: 900, currency: "USD", area: 64, rooms: 2, floor: 9, floors: 16, description: "ავეჯით და ტექნიკით, მეტროსთან ახლოს.", verified: false, brokered: false, updatedAt: new Date("2026-11-07") },
  { id: 20431, deal: "SALE", type: "APARTMENT", title: "ბინა ბათუმში, ზღვის ხედით", city: "ბათუმი", district: "ახალი ბულვარი", address: "შერიფ ხიმშიაშვილის ქ. 5", lat: 41.646, lng: 41.6305, price: 96500, priceUsd: 96500, currency: "USD", area: 58, rooms: 2, floor: 21, floors: 35, description: "ზღვის ხედი, თეთრი კარკასი.", verified: true, brokered: true, updatedAt: new Date("2026-11-05") },
  { id: 20440, deal: "SALE", type: "APARTMENT", title: "1 საძინებელი Dubai Marina-ში", city: "დუბაი", district: "Dubai Marina", address: "Marina Walk", lat: 25.0805, lng: 55.1403, price: 1450000, priceUsd: 394826, currency: "AED", area: 78, rooms: 2, description: "ავეჯით, აუზით და სპორტული დარბაზით.", verified: true, brokered: true, updatedAt: new Date("2026-11-04") },
];

/** Safe to run repeatedly: every row is upserted on a stable key. Refuses any non-local database. */
export async function seed(client: PrismaClient): Promise<void> {
  const { hostname } = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(hostname)) throw new Error("Demo seed only runs against a local database");

  const branchId = "seed-branch-vake";
  await client.branch.upsert({
    where: { id: branchId },
    update: {},
    create: { id: branchId, name: "ვაკის ფილიალი", city: "თბილისი" },
  });
  const phone = "+995 5XX XX XX XX";
  const user = await client.user.upsert({
    where: { phone },
    update: {},
    create: { phone, name: "ნინო ბერიძე", role: "AGENT" },
  });
  const agent = await client.agent.upsert({
    where: { userId: user.id },
    update: { branchId },
    create: { userId: user.id, branchId },
  });

  for (const { brokered, ...listing } of demoListings) {
    const data = { ...listing, status: "ACTIVE" as const, ownerId: user.id, agentId: brokered ? agent.id : null, verifiedAt: listing.verified ? listing.updatedAt : null, verifiedById: listing.verified ? agent.id : null };
    await client.listing.upsert({ where: { id: listing.id }, update: data, create: data });
  }

  // Rows above carry explicit ids, which do not advance the autoincrement sequence.
  await client.$executeRaw`SELECT setval(pg_get_serial_sequence('"Listing"', 'id'), (SELECT MAX(id) FROM "Listing"))`;
}
