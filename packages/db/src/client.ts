import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "DATABASE_URL must be a PostgreSQL connection string"),
});

const globalStore = globalThis as typeof globalThis & { mteamPrisma?: PrismaClient };

/**
 * The shared Prisma client. It is created on first use so that importing this
 * package needs no environment (next build), and kept on globalThis so that
 * dev-server reloads do not open a new connection pool each time.
 */
export function db(): PrismaClient {
  globalStore.mteamPrisma ??= new PrismaClient({ datasourceUrl: envSchema.parse(process.env).DATABASE_URL });
  return globalStore.mteamPrisma;
}
