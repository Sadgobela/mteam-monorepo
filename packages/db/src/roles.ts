import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

const roleSchema = z.enum(["USER", "AGENT", "ADMIN"]);

/** Gives an existing user a role. Staff get a broker record, which is what a verification is signed with. */
export async function promoteUser(client: PrismaClient, phone: string, role: string, name?: string): Promise<void> {
  const parsed = roleSchema.parse(role);
  const update = client.user.update({
    where: { phone },
    data: { role: parsed, name, agent: parsed === "USER" ? undefined : { upsert: { create: {}, update: {} } } },
  });
  if (parsed === "AGENT") {
    await update;
    return;
  }
  // Only a current broker answers for a listing, so their open chats go to the owner now rather than waiting for the buyer to write again.
  await client.$transaction([
    update,
    client.$executeRaw`
      UPDATE "Conversation" c SET "sellerId" = l."ownerId"
      FROM "Listing" l
      JOIN "Agent" a ON a.id = l."agentId"
      JOIN "User" u ON u.id = a."userId"
      WHERE c."listingId" = l.id AND c."sellerId" = u.id AND u.phone = ${phone}`,
  ]);
}
