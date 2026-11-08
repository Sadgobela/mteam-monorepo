import { afterEach, describe, expect, it, vi } from "vitest";

const created = vi.hoisted(() => [] as unknown[]);

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    constructor(options: unknown) {
      created.push(options);
    }
  },
}));

import { db } from "./index";

const url = "postgresql://user:pass@localhost:5432/db";

afterEach(() => {
  vi.unstubAllEnvs();
  delete (globalThis as { mteamPrisma?: unknown }).mteamPrisma;
  created.length = 0;
});

describe("db", () => {
  it("connects with DATABASE_URL and reuses one client", () => {
    vi.stubEnv("DATABASE_URL", url);
    expect(db()).toBe(db());
    expect(created).toEqual([{ datasourceUrl: url }]);
  });

  it.each([undefined, "", "mysql://user:pass@localhost/db"])("rejects DATABASE_URL %s", (value) => {
    vi.stubEnv("DATABASE_URL", value as string);
    expect(() => db()).toThrow();
    expect(created).toEqual([]);
  });

  it("does not put the connection string in the error", () => {
    vi.stubEnv("DATABASE_URL", "mysql://user:s3cret@localhost/db");
    let message = "";
    try {
      db();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("must be a PostgreSQL");
    expect(message).not.toContain("s3cret");
  });
});
