import { db } from "@mteam/db";
import { createListing } from "../support/data.ts";
import { expect, t, test } from "../support/fixtures.ts";

const my = t.myListings;

test("bump a live listing up the list, once a day", async ({ page, check, signIn }) => {
  const user = await signIn();
  const listing = await createListing(user.id);
  await check.visit("/en/my-listings?tab=active", t.my.heading);
  const row = page.locator("ul.mine > li").filter({ hasText: listing.title });

  await expect(async () => {
    await row.getByRole("button", { name: my.bump }).click({ timeout: 1_000 });
    await expect(page.locator(".ant-message").getByText(t.feedback.bumped)).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(row.getByRole("button", { name: my.bump })).toHaveCount(0);
  await expect.poll(async () => (await db().listing.findUniqueOrThrow({ where: { id: listing.id } })).bumpedAt).not.toBeNull();
  await check.page(t.my.heading);
});

test("delete a draft after confirming", async ({ page, check, signIn }) => {
  const user = await signIn();
  const draft = await createListing(user.id, { status: "DRAFT" });
  await check.visit("/en/my-listings?tab=draft", t.my.heading);
  const row = page.locator("ul.mine > li").filter({ hasText: draft.title });

  await expect(async () => {
    await row.getByRole("button", { name: t.ui.deleteDraft }).click({ timeout: 1_000 });
    await expect(page.locator(".ant-popconfirm:visible")).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await check.page(t.my.heading);
  // Saying no keeps it.
  await page.locator(".ant-popconfirm:visible").getByRole("button", { name: t.confirm.no }).click();
  await expect(row).toHaveCount(1);

  await row.getByRole("button", { name: t.ui.deleteDraft }).click();
  await page.locator(".ant-popconfirm:visible").getByRole("button", { name: t.confirm.yes }).click();
  await expect(page.locator(".ant-message").getByText(t.ui.draftDeleted)).toBeVisible();
  await expect(row).toHaveCount(0);
  await expect.poll(() => db().listing.count({ where: { id: draft.id } })).toBe(0);
});
