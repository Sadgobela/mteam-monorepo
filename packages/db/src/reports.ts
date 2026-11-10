import type { ReportDraft } from "@mteam/shared";
import { addressHash } from "./auth";
import { db } from "./client";

const REPORTS_PER_DAY = 20;
const DAY_MS = 24 * 60 * 60_000;

/** One report per address per listing, so one person cannot pile them up. Only published listings can be reported. */
export async function reportListing(listingId: number, report: ReportDraft, ip: string): Promise<void> {
  const client = db();
  const ipHash = addressHash(ip);
  // A slightly racy count is fine: this only stops one address filling the queue.
  const recent = await client.listingReport.count({ where: { ipHash, createdAt: { gte: new Date(Date.now() - DAY_MS) } } });
  if (recent >= REPORTS_PER_DAY) return;
  const listing = await client.listing.findFirst({ where: { id: listingId, status: "ACTIVE" }, select: { id: true } });
  if (listing) await client.listingReport.createMany({ data: [{ listingId, ...report, ipHash }], skipDuplicates: true });
}

export function listOpenReports() {
  return db().listingReport.findMany({
    where: { resolved: false },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, reason: true, note: true, createdAt: true, listing: { select: { id: true, title: true } } },
  });
}

export async function resolveReport(id: string): Promise<void> {
  await db().listingReport.updateMany({ where: { id }, data: { resolved: true } });
}

