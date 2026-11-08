import { PrismaClient } from "@prisma/client";
import { promoteUser } from "../src/roles.ts";

const [phone, role] = process.argv.slice(2);
const client = new PrismaClient();
await promoteUser(client, phone, role);
await client.$disconnect();
