import { db } from "@mteam/db";
import { SEED_LISTING_ID } from "./support/data.ts";
import "./support/env.ts";

/** Checks the e2e database and photo storage are ready, and clears the hourly limits earlier runs used up. */
export default async function globalSetup(): Promise<void> {
  const client = db();
  try {
    if (!(await client.listing.findUnique({ where: { id: SEED_LISTING_ID } }))) {
      throw new Error("The mteam_e2e database has no demo listings: run db:deploy and db:seed against it (docs/E2E.md).");
    }
    // Phone reveals and photo uploads are counted per hour in the database, and every test comes from the same address.
    await client.codeRequestLimit.deleteMany();
  } finally {
    await client.$disconnect();
  }
  const storage = await fetch("http://localhost:8333/mteam-photos/").catch(() => null);
  if (!storage) throw new Error("Photo storage is not running: docker compose up -d storage, then docker compose up storage-init (docs/E2E.md).");
}
