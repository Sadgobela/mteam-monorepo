import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { importListings } from "../src/import.ts";

const [file, ownerPhone, flag] = process.argv.slice(2);
const client = new PrismaClient();
const result = await importListings(client, readFileSync(file, "utf8"), { ownerPhone, publish: flag === "--publish" });
console.log(`Created ${result.created}, already imported ${result.skipped}, with problems ${result.problems.length}`);
for (const { row, reason } of result.problems) console.log(`Row ${row}: ${reason}`);
await client.$disconnect();
