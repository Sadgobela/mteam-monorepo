// @vitest-environment node
import { createHash, createHmac, generateKeyPairSync, verify } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appleClientSecret, configuredProviders, providerFlow, type Pending } from "./oauth";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const keys = {
  GOOGLE_CLIENT_ID: "g-id",
  GOOGLE_CLIENT_SECRET: "g-secret",
  FACEBOOK_APP_ID: "fb-id",
  FACEBOOK_APP_SECRET: "fb-secret",
  APPLE_CLIENT_ID: "a-id",
  APPLE_TEAM_ID: "TEAM",
  APPLE_KEY_ID: "KEY",
  // As pasted into an env var on one line.
  APPLE_PRIVATE_KEY: pem.replace(/\n/g, "\\n"),
};
const pending: Pending = { state: "st", nonce: "no", verifier: "ve", redirectUri: "http://localhost:3111/api/auth/x/callback" };
const now = new Date("2026-11-13T10:00:00Z");
const fetcher = vi.fn();

const idToken = (claims: object) => `head.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
const answer = (body: object, status = 200) => ({ ok: status < 400, status, json: async () => body });
const query = (address: string) => Object.fromEntries(new URL(address).searchParams);
const posted = (call: number) => Object.fromEntries(fetcher.mock.calls[call][1].body as URLSearchParams);
const setKeys = (values: Record<string, string>) => Object.entries(values).forEach(([name, value]) => vi.stubEnv(name, value));

beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
  vi.useFakeTimers({ now });
  for (const name of Object.keys(keys)) vi.stubEnv(name, undefined as unknown as string);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("configuredProviders", () => {
  it("offers only providers with all of their keys", () => {
    expect(configuredProviders()).toEqual([]);
    setKeys({ GOOGLE_CLIENT_ID: "g-id", APPLE_CLIENT_ID: "a-id", APPLE_TEAM_ID: "T" });
    expect(configuredProviders()).toEqual([]);
    setKeys(keys);
    expect(configuredProviders()).toEqual(["google", "facebook", "apple"]);
  });

  it("knows no provider outside the list, or one without keys", () => {
    expect(providerFlow("google")).toBeNull();
    setKeys(keys);
    expect(providerFlow("github")).toBeNull();
    expect(providerFlow("constructor")).toBeNull();
  });
});

describe("Google", () => {
  const claims = { iss: "https://accounts.google.com", aud: "g-id", exp: now.getTime() / 1000 + 60, sub: "g-1", nonce: "no", name: "Nino" };
  beforeEach(() => setKeys(keys));

  it("asks for the account with PKCE, a nonce and the state", () => {
    const sent = query(String(providerFlow("google")?.authorizeUrl(pending)));
    expect(sent).toMatchObject({ client_id: "g-id", redirect_uri: pending.redirectUri, response_type: "code", scope: "openid profile", state: "st", nonce: "no", code_challenge_method: "S256" });
    expect(sent.code_challenge).toBe(createHash("sha256").update("ve").digest("base64url"));
  });

  it("trades the code for an ID token and reads who it is", async () => {
    fetcher.mockResolvedValue(answer({ id_token: idToken(claims) }));
    expect(await providerFlow("google")?.person("c0de", pending)).toEqual({ subject: "g-1", name: "Nino" });
    expect(fetcher.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
    expect(posted(0)).toEqual({ code: "c0de", client_id: "g-id", client_secret: "g-secret", redirect_uri: pending.redirectUri, grant_type: "authorization_code", code_verifier: "ve" });
  });

  it("accepts the short issuer and a token without a name", async () => {
    fetcher.mockResolvedValue(answer({ id_token: idToken({ ...claims, iss: "accounts.google.com", name: undefined }) }));
    expect(await providerFlow("google")?.person("c0de", pending)).toEqual({ subject: "g-1", name: null });
  });

  it.each([
    ["another issuer", { iss: "https://evil.example" }],
    ["another app", { aud: "other" }],
    ["an expired token", { exp: now.getTime() / 1000 }],
    ["another sign-in", { nonce: "other" }],
  ])("refuses %s", async (_, change) => {
    fetcher.mockResolvedValue(answer({ id_token: idToken({ ...claims, ...change }) }));
    await expect(providerFlow("google")?.person("c0de", pending)).rejects.toThrow("not for this sign-in");
  });

  it("refuses a refused code and a token that is not a JWT", async () => {
    fetcher.mockResolvedValue(answer({ error: "invalid_grant" }, 400));
    await expect(providerFlow("google")?.person("c0de", pending)).rejects.toThrow("400");
    fetcher.mockResolvedValue(answer({ id_token: "nonsense" }));
    await expect(providerFlow("google")?.person("c0de", pending)).rejects.toThrow();
  });
});

describe("Facebook", () => {
  beforeEach(() => setKeys(keys));

  it("asks only for the public profile", () => {
    expect(query(String(providerFlow("facebook")?.authorizeUrl(pending)))).toEqual({ client_id: "fb-id", redirect_uri: pending.redirectUri, response_type: "code", scope: "public_profile", state: "st" });
  });

  it("trades the code for a token and reads the profile with proof of our app", async () => {
    fetcher.mockResolvedValueOnce(answer({ access_token: "tok" })).mockResolvedValueOnce(answer({ id: "fb-1", name: "Giorgi" }));
    expect(await providerFlow("facebook")?.person("c0de", pending)).toEqual({ subject: "fb-1", name: "Giorgi" });
    expect(query(fetcher.mock.calls[0][0])).toEqual({ client_id: "fb-id", client_secret: "fb-secret", redirect_uri: pending.redirectUri, code: "c0de" });
    expect(query(fetcher.mock.calls[1][0])).toEqual({ fields: "id,name", access_token: "tok", appsecret_proof: createHmac("sha256", "fb-secret").update("tok").digest("hex") });
  });

  it("copes with a profile without a name", async () => {
    fetcher.mockResolvedValueOnce(answer({ access_token: "tok" })).mockResolvedValueOnce(answer({ id: "fb-1" }));
    expect(await providerFlow("facebook")?.person("c0de", pending)).toEqual({ subject: "fb-1", name: null });
  });
});

describe("Apple", () => {
  const claims = { iss: "https://appleid.apple.com", aud: "a-id", exp: now.getTime() / 1000 + 60, sub: "a-1", nonce: "no" };
  beforeEach(() => setKeys(keys));

  it("asks for no scope, so the answer comes back as a plain redirect", () => {
    expect(query(String(providerFlow("apple")?.authorizeUrl(pending)))).toEqual({ client_id: "a-id", redirect_uri: pending.redirectUri, response_type: "code", response_mode: "query", state: "st", nonce: "no" });
  });

  it("signs its client secret with our key, for five minutes", () => {
    const [head, body, signature] = appleClientSecret(keys, now.getTime()).split(".");
    const read = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());
    expect(read(head)).toEqual({ alg: "ES256", kid: "KEY" });
    expect(read(body)).toEqual({ iss: "TEAM", iat: now.getTime() / 1000, exp: now.getTime() / 1000 + 300, aud: "https://appleid.apple.com", sub: "a-id" });
    expect(verify("sha256", Buffer.from(`${head}.${body}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url"))).toBe(true);
  });

  it("trades the code for an ID token", async () => {
    fetcher.mockResolvedValue(answer({ id_token: idToken(claims) }));
    expect(await providerFlow("apple")?.person("c0de", pending)).toEqual({ subject: "a-1", name: null });
    expect(fetcher.mock.calls[0][0]).toBe("https://appleid.apple.com/auth/token");
    expect(posted(0)).toMatchObject({ code: "c0de", client_id: "a-id", redirect_uri: pending.redirectUri, grant_type: "authorization_code" });
    expect(posted(0).client_secret.split(".")).toHaveLength(3);
  });
});
