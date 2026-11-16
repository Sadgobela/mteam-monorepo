// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const getListing = vi.hoisted(() => vi.fn());
const claimPhoneLookup = vi.hoisted(() => vi.fn(async () => true));
const countPhoneReveal = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@mteam/db", () => ({ claimPhoneLookup, countPhoneReveal, getListing }));
vi.mock("@/lib/session", () => ({ clientIp: async () => "1.2.3.4" }));

import { GET } from "./route";

const call = (id: string) => GET(new Request("http://localhost/"), { params: Promise.resolve({ id }) });

beforeEach(() => {
  getListing.mockReset();
  countPhoneReveal.mockClear();
});

describe("GET phone", () => {
  it("returns the contact number of a published listing and counts the reveal", async () => {
    getListing.mockResolvedValue({ id: 7, contactPhone: "+995555" });
    const response = await call("7");
    expect(await response.json()).toEqual({ phone: "+995555" });
    expect(getListing).toHaveBeenCalledWith("7");
    expect(countPhoneReveal).toHaveBeenCalledWith(7);
  });

  it("refuses an address past its limit without looking anything up", async () => {
    claimPhoneLookup.mockResolvedValueOnce(false);
    expect((await call("7")).status).toBe(429);
    expect(getListing).not.toHaveBeenCalled();
    expect(countPhoneReveal).not.toHaveBeenCalled();
  });

  it("is not found for anything else", async () => {
    getListing.mockResolvedValue(undefined);
    expect((await call("x")).status).toBe(404);
    expect(countPhoneReveal).not.toHaveBeenCalled();
  });

  it("is not found when the owner hid the number, so buyers use chat", async () => {
    getListing.mockResolvedValue({ id: 7, contactPhone: "+995555" });
    countPhoneReveal.mockResolvedValueOnce(false);
    const response = await call("7");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "notFound" });
  });
});
