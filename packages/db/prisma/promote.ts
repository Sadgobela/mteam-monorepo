import { PrismaClient } from "@prisma/client";
import { promoteUser } from "../src/roles.ts";

const [phone, role, name] = process.argv.slice(2);
const client = new PrismaClient();
await promoteUser(client, phone, role, name);
await client.$disconnect();
