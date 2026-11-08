import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

const roleSchema = z.enum(["USER", "AGENT", "ADMIN"]);

/** Gives an existing user a role. Staff get a broker record, which is what a verification is signed with. */
export async function promoteUser(client: PrismaClient, phone: string, role: string): Promise<void> {
  const parsed = roleSchema.parse(role);
  const user = await client.user.update({ where: { phone }, data: { role: parsed } });
  if (parsed !== "USER") await client.agent.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
}
