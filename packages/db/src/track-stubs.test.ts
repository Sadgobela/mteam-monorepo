import { describe, expect, it } from "vitest";
import { archiveExpiredListings, runNightlyNotifications } from "./index";

// Replaced by each track's own tests when it fills its module.
describe("nightly steps before their tracks land", () => {
  it("do nothing yet", async () => {
    expect(await archiveExpiredListings()).toBe(0);
    expect(await runNightlyNotifications()).toBe(0);
  });
});
