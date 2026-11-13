// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ signInWithIdentity: vi.fn() }));
const flow = vi.hoisted(() => ({ id: "GOOGLE", authorizeUrl: vi.fn(), person: vi.fn() }));
const oauth = vi.hoisted(() => ({ providerFlow: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("./oauth", () => oauth);

import { GET as callbackRoute } from "@/app/api/auth/[provider]/callback/route";
import { GET as startRoute } from "@/app/api/auth/[provider]/route";

const origin = "http://localhost:3111";
const params = (provider: string) => ({ params: Promise.resolve({ provider }) });
const saved = { provider: "google", state: "st", nonce: "no", verifier: "ve", next: "/en/saved", locale: "en" };
const back = (query: string, cookie: object | string | null = saved) =>
  new NextRequest(`${origin}/api/auth/google/callback?${query}`, {
    headers: cookie === null ? {} : { cookie: `mteam_social=${encodeURIComponent(typeof cookie === "string" ? cookie : JSON.stringify(cookie))}` },
  });
const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

beforeEach(() => {
  vi.resetAllMocks();
  oauth.providerFlow.mockReturnValue(flow);
  flow.authorizeUrl.mockReturnValue("https://accounts.example/auth?x=1");
  vi.stubEnv("SITE_URL", origin);
});

afterEach(() => vi.unstubAllEnvs());

describe("starting", () => {
  it("leaves for the provider and remembers this sign-in for ten minutes", async () => {
    const response = await startRoute(new NextRequest(`${origin}/api/auth/google?locale=ru&next=%2Fru%2Fsaved`), params("google"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://accounts.example/auth?x=1");

    const sent = flow.authorizeUrl.mock.calls[0][0];
    expect(sent.redirectUri).toBe(`${origin}/api/auth/google/callback`);
    expect(sent.state).toMatch(/^[\w-]{43}$/);
    expect(new Set([sent.state, sent.nonce, sent.verifier]).size).toBe(3);

    const cookie = response.cookies.get("mteam_social");
    expect(JSON.parse(String(cookie?.value))).toEqual({ provider: "google", state: sent.state, nonce: sent.nonce, verifier: sent.verifier, next: "/ru/saved", locale: "ru" });
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/api/auth", maxAge: 600 });
  });

  it("only comes back to one of our pages", async () => {
    const response = await startRoute(new NextRequest(`${origin}/api/auth/google?next=%2F%2Fevil.example`), params("google"));
    expect(JSON.parse(String(response.cookies.get("mteam_social")?.value))).toMatchObject({ next: "/ka", locale: "ka" });
  });

  it("knows no provider that is not set up", async () => {
    oauth.providerFlow.mockReturnValue(null);
    expect((await startRoute(new NextRequest(`${origin}/api/auth/github`), params("github"))).status).toBe(404);
  });
});

describe("live", () => {
  it("keeps the remembered sign-in in a __Host- cookie, which another subdomain or plain http cannot plant", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const started = await startRoute(new NextRequest(`${origin}/api/auth/google`), params("google"));
    expect(started.cookies.get("mteam_social")).toBeUndefined();
    const cookie = started.cookies.get("__Host-mteam_social");
    expect(cookie).toMatchObject({ secure: true, path: "/", httpOnly: true });

    flow.person.mockResolvedValue({ subject: "g-1" });
    db.signInWithIdentity.mockResolvedValue("tok");
    const request = new NextRequest(`${origin}/api/auth/google/callback?code=c0de&state=st`, { headers: { cookie: `__Host-mteam_social=${encodeURIComponent(JSON.stringify(saved))}` } });
    const finished = await callbackRoute(request, params("google"));
    expect(finished.headers.get("location")).toBe(`${origin}/en/saved`);
    expect(finished.cookies.get("__Host-mteam_social")).toMatchObject({ value: "", path: "/", maxAge: 0 });
  });
});

describe("coming back", () => {
  it("signs in and opens the page sign-in started from", async () => {
    flow.person.mockResolvedValue({ subject: "g-1" });
    db.signInWithIdentity.mockResolvedValue("tok");
    const response = await callbackRoute(back("code=c0de&state=st"), params("google"));

    expect(flow.person).toHaveBeenCalledWith("c0de", { ...saved, redirectUri: `${origin}/api/auth/google/callback` });
    expect(db.signInWithIdentity).toHaveBeenCalledWith("GOOGLE", "g-1");
    expect(response.headers.get("location")).toBe(`${origin}/en/saved`);
    expect(response.cookies.get("mteam_session")).toMatchObject({ value: "tok", httpOnly: true, path: "/" });
    expect(response.cookies.get("mteam_social")).toMatchObject({ value: "", maxAge: 0 });
  });

  it.each([
    ["another state", back("code=c0de&state=other")],
    ["a state of another length", back("code=c0de&state=s")],
    ["a state that is not plain text", back("code=c0de&state=%C3%A9t")],
    ["no state", back("code=c0de")],
    ["no code", back("state=st&error=access_denied")],
    ["no remembered sign-in", back("code=c0de&state=st", null)],
    ["a broken remembered sign-in", back("code=c0de&state=st", "{oops")],
    ["one started with another provider", back("code=c0de&state=st", { ...saved, provider: "facebook" })],
  ])("refuses %s and signs no one in", async (_, request) => {
    const response = await callbackRoute(request, params("google"));
    expect(flow.person).not.toHaveBeenCalled();
    expect(response.cookies.get("mteam_session")).toBeUndefined();
    expect(response.headers.get("location")).toMatch(/\/(en|ka)\/login\?next=%2F(en%2Fsaved|ka)&failed=social$/);
  });

  it("refuses a provider that is no longer set up", async () => {
    oauth.providerFlow.mockReturnValue(null);
    const response = await callbackRoute(back("code=c0de&state=st"), params("google"));
    expect(response.headers.get("location")).toBe(`${origin}/en/login?next=%2Fen%2Fsaved&failed=social`);
  });

  it("checks the remembered page again, in case the cookie was changed", async () => {
    flow.person.mockResolvedValue({ subject: "g-1" });
    db.signInWithIdentity.mockResolvedValue("tok");
    const response = await callbackRoute(back("code=c0de&state=st", { ...saved, next: "//evil.example" }), params("google"));
    expect(response.headers.get("location")).toBe(`${origin}/en`);
  });

  it("says so when the provider refuses the code", async () => {
    flow.person.mockRejectedValue(new Error("400"));
    const response = await callbackRoute(back("code=c0de&state=st"), params("google"));
    expect(response.headers.get("location")).toBe(`${origin}/en/login?next=%2Fen%2Fsaved&failed=social`);
    expect(response.cookies.get("mteam_session")).toBeUndefined();
    expect(errors).toHaveBeenCalled();
  });
});
