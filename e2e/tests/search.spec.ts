import type { Page } from "@playwright/test";
import { countListings } from "@mteam/db";
import { parseListingFilters } from "@mteam/shared";
import { expect, t, test } from "../support/fixtures.ts";

/** How many listings the database holds for a search, which is what every count on the page must say. */
const expected = (query: Record<string, string>) => countListings(parseListingFilters(query));

const found = (page: Page, count: number) => page.getByText(t.results.found.replace("{count}", String(count)), { exact: true });
const cards = (page: Page) => page.locator(".cards .card-wrap");

test("the assistant's buttons lead to results with the count they promised", async ({ page, check }) => {
  await check.visit("/en", t.assistant.heading);
  const assistant = page.locator(".assistant");
  // A click before the page has hydrated does nothing, so the first one is repeated until it takes.
  await expect(async () => {
    await assistant.getByRole("button", { name: t.assistant.deals.sale, exact: true }).click();
    await expect(assistant.getByRole("button", { name: t.propertyType.apartment, exact: true })).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await assistant.getByRole("button", { name: t.propertyType.apartment, exact: true }).click();
  await assistant.getByRole("button", { name: "Tbilisi", exact: true }).click();

  const count = await expected({ deal: "sale", type: "apartment", city: "თბილისი" });
  expect(count).toBeGreaterThan(0);
  const show = assistant.getByRole("link", { name: t.assistant.show.replace("{count}", String(count)) });
  await expect(show).toBeVisible();
  await show.click();
  await page.waitForURL((url) => url.searchParams.get("deal") === "sale" && url.searchParams.get("type") === "apartment");
  await expect(found(page, count)).toBeVisible();
  await expect(cards(page)).toHaveCount(count);
  await check.page(t.search.results);
});

test.describe("results filters", () => {
  test("the bar on a wide screen", async ({ page, check }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "a phone uses the filter sheet");
    await check.visit("/en?deal=sale", t.search.results);
    await expect(found(page, await expected({ deal: "sale" }))).toBeVisible();

    const rooms = page.locator(".pills").getByRole("button", { name: t.search.rooms, exact: true });
    await expect(async () => {
      await rooms.click();
      await expect(page.getByRole("radiogroup", { name: t.search.rooms, exact: true })).toBeVisible({ timeout: 1_000 });
    }).toPass();
    const panel = page.locator(".ant-popover:visible");
    await panel.getByRole("radio", { name: "3", exact: true }).click();
    await panel.getByRole("button", { name: t.search.submit }).click();

    await page.waitForURL((url) => url.searchParams.get("rooms") === "3");
    const count = await expected({ deal: "sale", rooms: "3" });
    await expect(found(page, count)).toBeVisible();
    await expect(cards(page)).toHaveCount(count);
    await check.page(t.search.results);
  });

  test("the sheet on a phone shows how many it will find", async ({ page, check }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "a wide screen has the full bar");
    await check.visit("/en?deal=sale", t.search.results);

    const open = page.getByRole("button", { name: new RegExp(`${t.ui.filters}$`) });
    const sheet = page.locator(".filter-sheet .ant-drawer-section");
    await expect(async () => {
      await open.click();
      await expect(sheet).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await sheet.getByRole("radiogroup", { name: t.search.rooms, exact: true }).getByRole("radio", { name: "2", exact: true }).click();

    const count = await expected({ deal: "sale", rooms: "2" });
    const show = page.locator(".filter-sheet").getByRole("button", { name: t.assistant.show.replace("{count}", String(count)) });
    await expect(show).toBeVisible();
    await show.click();

    await page.waitForURL((url) => url.searchParams.get("rooms") === "2");
    await expect(found(page, count)).toBeVisible();
    await expect(cards(page)).toHaveCount(count);
    await check.page(t.search.results);
  });
});
