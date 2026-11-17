import { db } from "@mteam/db";
import { createListing, createUser, SEED_LISTING_ID } from "../support/data.ts";
import { expect, t, test } from "../support/fixtures.ts";

test("open a listing from results and keep it as a favourite", async ({ page, check, signIn }) => {
  const user = await signIn();
  await check.visit("/en?deal=sale", t.search.results);
  const card = page.locator(".card-wrap").filter({ has: page.locator(`a[href="/en/listings/${SEED_LISTING_ID}"]`) });
  const toast = page.locator(".ant-message");
  const saved = () => db().favorite.count({ where: { userId: user.id, listingId: SEED_LISTING_ID } });

  // The heart flips before the server answers, then a toast confirms. Repeated until the page has hydrated.
  await expect(async () => {
    await card.getByRole("button", { name: t.favorites.add }).click({ timeout: 1_000 });
    await expect(card.getByRole("button", { name: t.favorites.remove })).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(toast.getByText(t.feedback.favoriteAdded)).toBeVisible();
  await expect.poll(saved).toBe(1);

  await card.getByRole("button", { name: t.favorites.remove }).click();
  await expect(card.getByRole("button", { name: t.favorites.add })).toBeVisible();
  await expect(toast.getByText(t.feedback.favoriteRemoved)).toBeVisible();
  await expect.poll(saved).toBe(0);

  await card.locator("a.card").click();
  await page.waitForURL(`/en/listings/${SEED_LISTING_ID}`);
  const { title } = await db().listing.findUniqueOrThrow({ where: { id: SEED_LISTING_ID } });
  await check.page(title);
});

test("the phone number shows when asked for", async ({ page, check }, testInfo) => {
  const owner = await createUser();
  const listing = await createListing(owner.id);
  await check.visit(`/en/listings/${listing.id}`, listing.title);

  const bar = page.locator(".contact-bar");
  if (testInfo.project.name === "phone") {
    // On a phone, call and write sit in a bar fixed to the foot of the screen.
    const box = await bar.boundingBox();
    expect(box && Math.round(box.y + box.height)).toBe(page.viewportSize()?.height);
  }
  await expect(async () => {
    await bar.getByRole("button", { name: new RegExp(t.listing.showPhone) }).click({ timeout: 1_000 });
    await expect(bar.locator(`a[href="tel:${owner.phone}"]`)).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(bar.getByRole("link", { name: t.listing.whatsapp })).toHaveAttribute("href", `https://wa.me/${owner.phone.replace(/\D/g, "")}`);
  await check.page(listing.title);
});

test("write opens the message box and sends to a new chat", async ({ page, check, signIn }) => {
  await signIn();
  const owner = await createUser();
  const listing = await createListing(owner.id);
  await check.visit(`/en/listings/${listing.id}`, listing.title);

  const write = page.locator(".contact-bar").getByRole("button", { name: t.ui.write });
  const box = page.getByRole("textbox", { name: t.chat.write });
  await expect(async () => {
    await write.click({ timeout: 1_000 });
    await expect(box).toBeFocused({ timeout: 1_000 });
  }).toPass();
  await expect(write).toHaveAttribute("aria-expanded", "true");
  await check.page(listing.title);

  await box.fill("Is it still available?");
  await page.locator(".chat-form").getByRole("button", { name: t.chat.send }).click();
  await page.waitForURL(/\/en\/messages\/\w+/);
  await expect(page.getByText("Is it still available?")).toBeVisible();
  await check.page();
});

test("signed out, write leads to sign-in", async ({ page, check }) => {
  await check.visit(`/en/listings/${SEED_LISTING_ID}`);
  await expect(page.locator(".contact-bar").getByRole("link", { name: t.chat.signIn })).toHaveAttribute("href", /\/en\/login\?next=/);
});
