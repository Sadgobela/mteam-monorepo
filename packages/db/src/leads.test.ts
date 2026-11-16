import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ lead: { findFirst: vi.fn(), create: vi.fn() } }));

vi.mock("./client", () => ({ db: () => prisma }));

import { createLead } from "./index";

const lead = { name: "Nino", phone: "+995555123456", deal: "rent", search: undefined } as const;

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ now: new Date("2026-11-09T10:00:00Z") });
});

afterEach(() => vi.useRealTimers());

describe("createLead", () => {
  it("stores a new lead", async () => {
    prisma.lead.findFirst.mockResolvedValue(null);
    await createLead(lead);
    expect(prisma.lead.create).toHaveBeenCalledWith({ data: { name: "Nino", phone: "+995555123456", deal: "RENT", search: undefined } });
    expect(prisma.lead.findFirst.mock.calls[0][0].where).toEqual({
      phone: "+995555123456",
      createdAt: { gte: new Date("2026-11-08T10:00:00Z") },
    });
  });

  it("stores a seeker's search", async () => {
    prisma.lead.findFirst.mockResolvedValue(null);
    await createLead({ ...lead, deal: "daily", search: "deal=daily" });
    expect(prisma.lead.create).toHaveBeenCalledWith({ data: { name: "Nino", phone: "+995555123456", deal: "DAILY", search: "deal=daily" } });
  });

  it("ignores a repeat within a day", async () => {
    prisma.lead.findFirst.mockResolvedValue({ id: "l1" });
    await createLead(lead);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });
});
