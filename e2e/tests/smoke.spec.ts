import { createConversation, createListing, createUser, SEED_BRANCH_ID, SEED_LISTING_ID, seedAgentId } from "../support/data.ts";
import { expect, t, test } from "../support/fixtures.ts";

/** Public pages, the same for everyone. A private seller's page needs an owner with a live listing of their own. */
async function publicPages(): Promise<[string, string][]> {
  const seller = await createUser();
  await createListing(seller.id);
  return [
  ["home", "/en"],
  ["results", "/en?deal=sale"],
  ["results as a list", "/en?deal=sale&view=list"],
  ["map view", "/en?deal=sale&view=map"],
  ["listing", `/en/listings/${SEED_LISTING_ID}`],
  ["prices", "/en/prices"],
  ["mortgage", "/en/mortgage"],
  ["brokers", "/en/brokers"],
  ["broker", `/en/brokers/${await seedAgentId()}`],
  ["branch", `/en/branches/${SEED_BRANCH_ID}`],
  ["seller", `/en/sellers/${seller.id}`],
  ];
}

/** Pages of the signed-in area. Signed out, each sends the visitor to sign in. */
const accountPages: [string, string][] = [
  ["my listings", "/en/my-listings"],
  ["my listings: active", "/en/my-listings?tab=active"],
  ["my listings: pending", "/en/my-listings?tab=pending"],
  ["my listings: draft", "/en/my-listings?tab=draft"],
  ["my listings: expiring", "/en/my-listings?tab=expiring"],
  ["my listings: archived", "/en/my-listings?tab=archived"],
  ["my listings: rejected", "/en/my-listings?tab=rejected"],
  ["messages", "/en/messages"],
  ["favourites", "/en/favorites"],
  ["saved searches", "/en/saved"],
  ["notifications", "/en/account/notifications"],
  ["profile", "/en/account/profile"],
  ["settings", "/en/account/settings"],
  ["security", "/en/account/security"],
  ["posting form", "/en/listings/new"],
];

test.describe("signed out", () => {
  test("public pages", async ({ check }) => {
    for (const [name, path] of await publicPages()) {
      await test.step(name, () => check.visit(path));
    }
  });

  test("sign-in page", async ({ check }) => {
    await check.visit("/en/login");
  });

  test("account pages send the visitor to sign in", async ({ page, check }) => {
    for (const [name, path] of accountPages) {
      await test.step(name, async () => {
        // The redirect can come after the page has started streaming, as a client-side navigation.
        await page.goto(path);
        await page.waitForURL((url) => url.pathname === "/en/login");
        await check.page();
      });
    }
  });

  test("the admin panel is not found", async ({ page, errors }) => {
    expect((await page.goto("/en/admin"))?.status()).toBe(404);
    // Chromium logs the 404 this test expects as a console error.
    expect(errors).toEqual([expect.stringContaining("status of 404")]);
    errors.length = 0;
  });
});

test.describe("signed in", () => {
  test("public pages", async ({ check, signIn }) => {
    await signIn();
    for (const [name, path] of await publicPages()) {
      await test.step(name, () => check.visit(path));
    }
  });

  test("account pages", async ({ check, signIn }) => {
    await signIn();
    for (const [name, path] of accountPages) {
      await test.step(name, () => check.visit(path));
    }
  });

  // Moving inside the app renders each page's loading state in the browser, which a fresh load can skip.
  test("account pages through the side menu", async ({ page, check, signIn }) => {
    await signIn({ role: "AGENT" });
    await check.visit("/en/my-listings");
    const menu = page.getByRole("navigation", { name: t.account.heading });
    const names = [t.nav.messages, t.nav.favorites, t.nav.saved, t.account.notifications, t.account.profile, t.brokersAdmin.profile, t.account.settings, t.nav.my];
    for (const name of names) {
      await test.step(name, async () => {
        const link = menu.getByRole("link", { name, exact: true });
        const href = await link.getAttribute("href");
        await link.click();
        await page.waitForURL((url) => url.pathname === href);
        await expect(link).toHaveAttribute("aria-current", "page");
        await check.page();
      });
    }
  });

  test("a conversation", async ({ check, signIn }) => {
    const user = await signIn();
    await check.visit(`/en/messages/${await createConversation(user.id)}`);
  });

  test("the edit page of one's own listing", async ({ check, signIn }) => {
    const user = await signIn();
    const listing = await createListing(user.id);
    await check.visit(`/en/listings/${listing.id}/edit`);
  });

  test("onboarding, for a new account", async ({ check, signIn }) => {
    await signIn({ onboarded: false });
    await check.visit("/en/onboarding");
  });

  test("admin panel and brokers, as an admin", async ({ check, signIn }) => {
    await signIn({ role: "ADMIN" });
    await check.visit("/en/admin", t.admin.heading);
    await check.visit("/en/admin/brokers");
  });

  test("admin panel, as a broker", async ({ check, signIn }) => {
    await signIn({ role: "AGENT" });
    await check.visit("/en/admin", t.admin.heading);
  });
});
