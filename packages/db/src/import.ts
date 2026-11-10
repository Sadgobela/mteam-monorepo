import type { PrismaClient } from "@prisma/client";
import { draftFields, draftProblems, MAX_PHOTOS, parseListingDraft, parsePhone, type ListingDraft } from "@mteam/shared";
import { streetsIn } from "@mteam/shared/streets";
import { draftColumns } from "./listings";

const COLUMNS = new Set([...draftFields, "ref", "agentPhone", "photos"]);

/** Excel's CSV. Quoted cells may hold separators, line breaks and doubled quotes, and a European Excel separates with semicolons. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split("\n", 1)[0];
  const separator = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') cell += char;
      else if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === separator) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      rows.push([...row, cell]);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell || row.length > 0) rows.push([...row, cell]);
  return rows;
}

type Parsed = { draft: ListingDraft; agentId: string | null; photos: string[] };

/** A row as a listing, or the name of what is wrong with it. */
function readRow(fields: Record<string, string>, agents: Map<string, string>): Parsed | string {
  const draft = parseListingDraft(fields);
  if (!draft) return draftProblems(fields).join(", ");
  // The same check as the posting route: a street not on the list could never be found by the street filter.
  if (draft.street && !streetsIn(draft.city, draft.district ? [draft.district] : []).includes(draft.street)) return "street";
  const agentId = fields.agentPhone ? agents.get(parsePhone(fields.agentPhone) ?? "") : null;
  if (agentId === undefined) return "agentPhone";
  const photos = fields.photos?.split("|").filter(Boolean) ?? [];
  if (photos.length > MAX_PHOTOS || !photos.every((url) => /^https?:\/\/\S+$/.test(url))) return "photos";
  return { draft, agentId, photos };
}

export type ImportResult = { created: number; skipped: number; problems: { row: number; reason: string }[] };

/**
 * Adds listings from a CSV file, row by row. A bad row is reported and the rest still go in, and rows imported before
 * are skipped, so a fixed file can simply be run again. Nothing is ever marked verified: that takes a broker's visit.
 */
export async function importListings(client: PrismaClient, csv: string, { ownerPhone, publish = false }: { ownerPhone: string; publish?: boolean }): Promise<ImportResult> {
  const [rawHeader = [], ...rows] = parseCsv(csv);
  const header = rawHeader.map((name) => name.trim());
  const unknown = header.filter((name) => !COLUMNS.has(name));
  if (unknown.length > 0) throw new Error(`Columns not recognised: ${unknown.join(", ")}`);
  if (!header.includes("ref")) throw new Error("The ref column is missing");

  const owner = await client.user.findUnique({ where: { phone: parsePhone(ownerPhone) ?? "" }, select: { id: true } });
  if (!owner) throw new Error("No user has that phone number");
  const agents = new Map((await client.agent.findMany({ where: { user: { role: "AGENT" } }, select: { id: true, user: { select: { phone: true } } } })).map((agent) => [agent.user.phone, agent.id]));
  const seen = new Set((await client.listing.findMany({ where: { sourceRef: { not: null } }, select: { sourceRef: true } })).map((listing) => listing.sourceRef));

  const result: ImportResult = { created: 0, skipped: 0, problems: [] };
  for (const [index, cells] of rows.entries()) {
    if (cells.every((cell) => cell.trim() === "")) continue; // Excel leaves empty rows at the end
    const row = index + 2; // the number Excel shows, counting the header
    if (cells.length !== header.length) {
      result.problems.push({ row, reason: "number of columns" });
      continue;
    }
    // A blank cell means the field is not given, which is what the optional fields expect.
    const fields = Object.fromEntries(header.flatMap((name, column) => (cells[column].trim() ? [[name, cells[column].trim()]] : []))) as Record<string, string>;
    if (!fields.ref) {
      result.problems.push({ row, reason: "ref" });
      continue;
    }
    if (seen.has(fields.ref)) {
      result.skipped++;
      continue;
    }
    const parsed = readRow(fields, agents);
    if (typeof parsed === "string") {
      result.problems.push({ row, reason: parsed });
      continue;
    }
    await client.listing.create({
      data: {
        ...draftColumns(parsed.draft),
        status: publish ? "ACTIVE" : "PENDING",
        verified: false,
        sourceRef: fields.ref,
        ownerId: owner.id,
        agentId: parsed.agentId,
        images: { create: parsed.photos.map((url, position) => ({ url, position })) },
      },
      select: { id: true },
    });
    seen.add(fields.ref);
    result.created++;
  }
  return result;
}
