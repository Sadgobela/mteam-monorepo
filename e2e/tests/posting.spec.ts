import type { Page } from "@playwright/test";
import { db } from "@mteam/db";
import { cities, cityDistricts, placeLabel } from "@mteam/shared";
import { signIn, tag } from "../support/data.ts";
import { BASE_URL } from "../support/env.ts";
import { expect, t, test, type Checks } from "../support/fixtures.ts";

const f = t.post.fields;

/** Picks an option in one of the form's searchable dropdowns by typing its label. */
async function choose(page: Page, label: string, option: string) {
  const select = page.locator("fieldset.step:not(.off)").getByLabel(label, { exact: true });
  await select.click();
  await select.fill(option);
  await page.locator(".ant-select-dropdown:visible").getByTitle(option, { exact: true }).click();
}

/** A small real JPEG, drawn by the browser itself, so no image file lives in the repo. */
async function jpeg(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 48;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    context.fillStyle = "#986dc6";
    context.fillRect(0, 0, 64, 48);
    return canvas.toDataURL("image/jpeg", 0.8);
  });
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

/** Goes to the next step and checks the page there. */
async function next(page: Page, check: Checks, step: string) {
  await page.getByRole("button", { name: t.post.next, exact: true }).click();
  await expect(page.locator("fieldset.step:not(.off)")).toHaveAttribute("aria-label", step);
  await check.page();
}

test("post a listing, have it approved, then change its price", async ({ page, check, browser }) => {
  test.slow();
  const owner = await signIn(page.context());
  const title = `E2E post ${tag()}`;
  const district = cityDistricts(cities[0])[0];

  await test.step("place", async () => {
    await check.visit("/en/listings/new", t.post.heading);
    // A pick before the page has hydrated is lost, so the first one is repeated until it takes.
    await expect(async () => {
      await choose(page, t.search.deal, t.deal.lease);
      await expect(page.locator('input[name="deal"]')).toHaveValue("lease", { timeout: 1_000 });
    }).toPass();
    await choose(page, f.district, placeLabel(district, "en"));
    await page.getByLabel(f.address, { exact: true }).fill("E2E street 7");
  });

  await test.step("details", async () => {
    await next(page, check, t.post.steps.details);
    await page.getByLabel(f.area, { exact: true }).fill("54");
    await page.getByLabel(f.rooms, { exact: true }).fill("2");
    await page.getByLabel(f.title, { exact: true }).fill(title);
    await page.getByLabel(f.description, { exact: true }).fill("A bright flat posted by the end-to-end tests.");
  });

  await test.step("price", async () => {
    await next(page, check, t.post.steps.price);
    await page.getByRole("spinbutton", { name: f.price, exact: true }).fill("900");
  });

  await test.step("photos", async () => {
    await next(page, check, t.post.steps.photos);
    await page.locator("fieldset.step:not(.off) input[type=file]").setInputFiles({ name: "flat.jpg", mimeType: "image/jpeg", buffer: await jpeg(page) });
    await expect(page.locator(".photo-list li")).toHaveCount(1);
  });

  await test.step("contact and send", async () => {
    await next(page, check, t.post.steps.contact);
    await page.getByRole("button", { name: t.post.submit }).click();
    await page.waitForURL((url) => url.pathname === "/en/listings/new" && url.searchParams.get("sent") === "1");
    await expect(page.getByRole("status").filter({ hasText: t.post.sent })).toBeVisible();
    await check.page(t.post.heading);
  });

  const listing = await db().listing.findFirstOrThrow({ where: { ownerId: owner.id, title }, include: { images: true } });
  expect(listing.status).toBe("PENDING");
  expect(listing.deal).toBe("LEASE");
  expect(listing.images).toHaveLength(1);
  expect(listing.images[0].url).toMatch(/^http:\/\/localhost:8333\/mteam-photos\//);
  // The stored photo is served, so cards and the gallery can show it.
  expect((await page.request.get(listing.images[0].url)).ok()).toBe(true);

  await test.step("an admin approves it", async () => {
    const admin = await browser.newContext({ baseURL: BASE_URL });
    try {
      await signIn(admin, { role: "ADMIN" });
      const adminPage = await admin.newPage();
      await adminPage.goto("/en/admin");
      const pending = adminPage.locator("section.queue").filter({ has: adminPage.getByRole("heading", { name: t.admin.pending }) });
      const row = pending.locator("li").filter({ hasText: title });
      await expect(row.locator('input[name="editedAt"]')).toHaveValue(listing.updatedAt.toISOString());
      await row.getByRole("button", { name: t.admin.approve }).click();
      await expect(row).toHaveCount(0);
    } finally {
      await admin.close();
    }
    await expect.poll(async () => (await db().listing.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe("ACTIVE");
  });

  await test.step("it shows in results", async () => {
    await check.visit(`/en?deal=lease&q=${encodeURIComponent(title)}`, t.search.results);
    await expect(page.locator(`.cards a[href="/en/listings/${listing.id}"]`)).toBeVisible();
  });

  await test.step("the owner changes only the price, and it stays live", async () => {
    await check.visit(`/en/listings/${listing.id}/edit`);
    await expect(async () => {
      await page.getByRole("button", { name: t.post.next, exact: true }).click({ timeout: 1_000 });
      await expect(page.locator("fieldset.step:not(.off)")).toHaveAttribute("aria-label", t.post.steps.details, { timeout: 1_000 });
    }).toPass();
    await next(page, check, t.post.steps.price);
    await page.getByRole("spinbutton", { name: f.price, exact: true }).fill("850");
    await next(page, check, t.post.steps.photos);
    await next(page, check, t.post.steps.contact);
    await page.getByRole("button", { name: t.post.save }).click();
    await page.waitForURL((url) => url.searchParams.get("saved") === "1");
    const saved = await db().listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(saved.price).toBe(850);
    expect(saved.status).toBe("ACTIVE");
  });
});
