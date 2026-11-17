import { randomInt, randomUUID } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import { createSession, db, startConversation } from "@mteam/db";
import { BASE_URL } from "./env.ts";

/** Demo rows from packages/db/src/seed.ts. */
export const SEED_LISTING_ID = 20418;
export const SEED_BRANCH_ID = "seed-branch-vake";

/** The deal every test-made listing uses: no search test filters on it, so their counts never move. */
export const TEST_DEAL = "LEASE";

export type Role = "USER" | "AGENT" | "ADMIN";

export interface TestUser {
  id: string;
  name: string;
  phone: string;
  agentId?: string;
}

/** A short random tag that keeps one test's rows apart from every other's, in this run and the ones before it. */
export const tag = () => randomUUID().slice(0, 8);

/** "+995 000" is not a Georgian number range, so these can never reach a real person. */
const fakePhone = () => `+995000${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;

/** A new account, onboarded unless asked otherwise; an agent belongs to the demo branch. */
export async function createUser({ role = "USER", onboarded = true }: { role?: Role; onboarded?: boolean } = {}): Promise<TestUser> {
  const name = `E2E ${role.toLowerCase()} ${tag()}`;
  const now = new Date();
  const user = await db().user.create({
    data: { phone: fakePhone(), name, role, ...(onboarded ? { onboardedAt: now, termsAcceptedAt: now, intent: "SEEKING" } : {}) },
  });
  const agent = role === "AGENT" ? await db().agent.create({ data: { userId: user.id, branchId: SEED_BRANCH_ID } }) : null;
  return { id: user.id, name, phone: user.phone ?? "", agentId: agent?.id };
}

/**
 * Signs the browser in as a new user without an SMS: a session made straight in the database, set as the cookie the app
 * reads (apps/web/src/lib/session.ts). Nothing in the app itself knows about this.
 */
export async function signIn(context: BrowserContext, options?: Parameters<typeof createUser>[0]): Promise<TestUser> {
  const user = await createUser(options);
  const token = await createSession(user.id, "e2e");
  await context.addCookies([{ name: "mteam_session", value: token, url: BASE_URL, httpOnly: true, sameSite: "Lax", secure: true }]);
  return user;
}

/** A listing owned by `ownerId`, as posting would leave it, findable by its unique title. */
export async function createListing(ownerId: string, { status = "ACTIVE", title = `E2E listing ${tag()}` }: { status?: "ACTIVE" | "DRAFT" | "PENDING"; title?: string } = {}) {
  const priceUsd = 1200;
  return db().listing.create({
    data: {
      status,
      deal: TEST_DEAL,
      type: "APARTMENT",
      title,
      description: "A test listing made by the end-to-end tests.",
      city: "თბილისი",
      district: "ვაკე",
      address: "E2E street 1",
      price: priceUsd,
      priceUsd,
      pricePerSqmUsd: Math.round(priceUsd / 60),
      currency: "USD",
      area: 60,
      rooms: 2,
      ownerId,
    },
  });
}

/** A conversation between a new buyer and the demo listing's seller, with one message. */
export async function createConversation(buyerId: string): Promise<string> {
  const id = await startConversation(buyerId, SEED_LISTING_ID, "Hello from the e2e tests");
  if (!id) throw new Error("Could not start a conversation on the demo listing");
  return id;
}

/** The demo broker's agent id. */
export async function seedAgentId(): Promise<string> {
  const listing = await db().listing.findUniqueOrThrow({ where: { id: SEED_LISTING_ID }, select: { agentId: true } });
  if (!listing.agentId) throw new Error("The demo listing has no broker");
  return listing.agentId;
}
