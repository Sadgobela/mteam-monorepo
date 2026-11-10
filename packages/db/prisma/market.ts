import { db } from "../src/client.ts";
import { refreshMarketLevels } from "../src/market.ts";

console.log(`Updated ${await refreshMarketLevels()} listings`);
await db().$disconnect();
