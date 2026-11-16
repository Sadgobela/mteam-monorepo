import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { handBackChats } from "./roles";

describe("handBackChats", () => {
  it("gives a former broker's chats on their listings to the owners", async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(2) };
    expect(await handBackChats(tx as unknown as Prisma.TransactionClient, "u1")).toBe(2);
    const [sql, ...values] = tx.$executeRaw.mock.calls[0];
    expect(sql.join("?")).toMatch(/UPDATE "Conversation" c SET "sellerId" = l."ownerId"/);
    expect(values).toEqual(["u1", "u1"]);
  });
});
