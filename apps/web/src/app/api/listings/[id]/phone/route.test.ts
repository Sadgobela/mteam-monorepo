// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const getListing = vi.hoisted(() => vi.fn());
const claimPhoneLookup = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@mteam/db", () => ({ claimPhoneLookup, getListing }));
vi.mock("@/lib/session", () => ({ clientIp: async () => "1.2.3.4" }));

import { GET } from "./route";

const call = (id: string) => GET(new Request("http://localhost/"), { params: Promise.resolve({ id }) });

describe("GET phone", () => {
  it("returns the contact number of a published listing", async () => {
    getListing.mockResolvedValue({ contactPhone: "+995555" });
    const response = await call("7");
    expect(await response.json()).toEqual({ phone: "+995555" });
    expect(getListing).toHaveBeenCalledWith("7");
  });

  it("refuses an address past its limit without looking anything up", async () => {
    getListing.mockClear();
    claimPhoneLookup.mockResolvedValueOnce(false);
    expect((await call("7")).status).toBe(429);
    expect(getListing).not.toHaveBeenCalled();
  });

  it("is not found for anything else", async () => {
    getListing.mockResolvedValue(undefined);
    expect((await call("x")).status).toBe(404);
  });
});
