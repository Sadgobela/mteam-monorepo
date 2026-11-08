import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

const roleSchema = z.enum(["USER", "AGENT", "ADMIN"]);

/** Gives an existing user a role. Staff get a broker record, which is what a verification is signed with. */
export async function promoteUser(client: PrismaClient, phone: string, role: string, name?: string): Promise<void> {
  const parsed = roleSchema.parse(role);
  await client.user.update({
    where: { phone },
    data: { role: parsed, name, agent: parsed === "USER" ? undefined : { upsert: { create: {}, update: {} } } },
  });
}
