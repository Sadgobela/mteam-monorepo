import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, middleware } from "./middleware";

const run = (path: string) => middleware(new NextRequest(new URL(path, "https://mteam.ge")));

describe("middleware", () => {
  it("redirects the root to Georgian", () => {
    expect(run("/").headers.get("location")).toBe("https://mteam.ge/ka");
  });

  it("adds the default locale to other paths", () => {
    expect(run("/listings/1").headers.get("location")).toBe("https://mteam.ge/ka/listings/1");
  });

  it("lets localized paths through", () => {
    expect(run("/en/listings/1").headers.get("location")).toBeNull();
  });

  it("skips static files and the API", () => {
    expect(config.matcher[0]).toContain("api");
  });
});
