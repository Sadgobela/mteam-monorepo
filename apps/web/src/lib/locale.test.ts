import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { resolveLocale } from "./locale";

describe("resolveLocale", () => {
  it("returns a supported locale", () => {
    expect(resolveLocale("en")).toBe("en");
  });

  it("shows 404 for an unknown locale", () => {
    expect(() => resolveLocale("de")).toThrow("NEXT_NOT_FOUND");
  });
});
