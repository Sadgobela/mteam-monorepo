// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const getListing = vi.hoisted(() => vi.fn());
vi.mock("@mteam/db", () => ({ getListing }));

import { GET } from "./route";

const call = (id: string) => GET(new Request("http://localhost/"), { params: Promise.resolve({ id }) });

describe("GET phone", () => {
  it("returns the contact number of a published listing", async () => {
    getListing.mockResolvedValue({ contactPhone: "+995555" });
    const response = await call("7");
    expect(await response.json()).toEqual({ phone: "+995555" });
    expect(getListing).toHaveBeenCalledWith("7");
  });

  it("is not found for anything else", async () => {
    getListing.mockResolvedValue(undefined);
    expect((await call("x")).status).toBe(404);
  });
});
