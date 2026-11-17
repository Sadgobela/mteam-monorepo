import { db } from "@mteam/db";
import { tag } from "../support/data.ts";
import { expect, t, test } from "../support/fixtures.ts";

test("a new account answers the first-visit questions, then goes on", async ({ page, check, signIn }) => {
  const user = await signIn({ onboarded: false });
  await page.goto("/en/favorites");
  await page.waitForURL((url) => url.pathname === "/en/onboarding" && url.searchParams.get("next") === "/en/favorites");
  await check.page(t.profile.welcome);

  await page.getByLabel(t.profile.name).fill(`New person ${tag()}`);
  await page.getByRole("radiogroup", { name: t.profile.intent }).getByRole("radio", { name: t.profile.intents.OWNER }).click();
  await page.getByLabel(t.profile.terms).check();
  await page.getByRole("button", { name: t.profile.start }).click();

  await page.waitForURL((url) => url.pathname === "/en/favorites");
  await check.page(t.favorites.heading);
  const saved = await db().user.findUniqueOrThrow({ where: { id: user.id } });
  expect(saved.onboardedAt).not.toBeNull();
  expect(saved.intent).toBe("OWNER");
});

test("the profile saves a new name", async ({ page, check, signIn }) => {
  const user = await signIn();
  await check.visit("/en/account/profile", t.account.profile);
  const name = `Renamed ${tag()}`;
  const field = page.getByLabel(t.profile.name);
  await field.fill(name);
  await page.getByRole("button", { name: t.profile.save, exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: t.profile.saved })).toBeVisible();
  await expect.poll(async () => (await db().user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe(name);
  await check.page(t.account.profile);
});

test("a settings switch saves at once and says so", async ({ page, check, signIn }) => {
  const user = await signIn();
  await check.visit("/en/account/settings", t.account.settings);
  const toggle = page.getByRole("switch", { name: t.settings.notifyMessages });
  await expect(toggle).toBeChecked();
  await expect(async () => {
    await toggle.click({ timeout: 1_000 });
    await expect(toggle).not.toBeChecked({ timeout: 1_000 });
  }).toPass();
  await expect(page.locator(".ant-message").getByText(t.feedback.saved)).toBeVisible();
  await expect.poll(async () => (await db().user.findUniqueOrThrow({ where: { id: user.id } })).notifyMessages).toBe(false);
});

test("the avatar menu shows the name, and signing out ends the session", async ({ page, check, signIn }) => {
  const user = await signIn();
  await check.visit("/en");
  const account = page.getByRole("button", { name: t.nav.account });
  const menu = page.locator(".ant-dropdown:visible");
  await expect(async () => {
    await account.click({ timeout: 1_000 });
    await expect(menu.getByText(user.name, { exact: true })).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(menu.getByRole("link", { name: t.account.profile })).toBeVisible();

  await menu.getByRole("button", { name: t.nav.logout }).click();
  await expect(account).toBeHidden();
  await expect.poll(() => db().session.count({ where: { userId: user.id } })).toBe(0);
  await page.goto("/en/favorites");
  await page.waitForURL((url) => url.pathname === "/en/login");
  await check.page();
});

test("features without their keys stay hidden", async ({ page, check, signIn }) => {
  await check.visit("/en", t.assistant.heading);
  // No AI key: the assistant offers buttons only.
  await expect(page.getByRole("textbox", { name: t.assistant.message })).toHaveCount(0);
  // No Google, Facebook or Apple keys: phone and email only.
  await check.visit("/en/login");
  await expect(page.locator(".social")).toHaveCount(0);

  await signIn();
  // No push keys: no push section.
  await check.visit("/en/account/settings", t.account.settings);
  await expect(page.getByRole("heading", { name: t.push.heading })).toHaveCount(0);
  // No AI key: no "write the description" button on the posting form.
  await check.visit("/en/listings/new", t.post.heading);
  await expect(page.getByRole("button", { name: t.post.ai.write })).toHaveCount(0);
});
