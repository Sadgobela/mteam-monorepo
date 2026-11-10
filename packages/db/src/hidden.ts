import { db } from "./client";

/** Sets a listing to the state the user asked for, so a double click cannot undo it. */
export async function setHidden(userId: string, listingId: number, want: boolean): Promise<void> {
  const client = db();
  if (want) await client.hiddenListing.createMany({ data: [{ userId, listingId }], skipDuplicates: true });
  else await client.hiddenListing.deleteMany({ where: { userId, listingId } });
}

export async function getHiddenIds(userId: string): Promise<number[]> {
  const rows = await db().hiddenListing.findMany({ where: { userId }, select: { listingId: true } });
  return rows.map((row) => row.listingId);
}
