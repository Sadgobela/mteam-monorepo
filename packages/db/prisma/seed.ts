import { PrismaClient } from "@prisma/client";
import { seed } from "../src/seed.ts";

const client = new PrismaClient();
await seed(client);
await client.$disconnect();
