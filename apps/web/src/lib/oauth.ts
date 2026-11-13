import { createHash, createHmac, sign } from "node:crypto";
import type { IdentityProvider } from "@mteam/db";
import { z } from "zod";

export const providerNames = ["google", "facebook", "apple"] as const;
export type ProviderName = (typeof providerNames)[number];

/** Each provider is on only when all of its keys are set, so a half-configured one never shows a button. Empty counts as unset. */
const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
});
type Env = z.infer<typeof envSchema>;

export interface Pending {
  state: string;
  nonce: string;
  verifier: string;
  redirectUri: string;
}

/** Only the provider's id: no name is asked for, so nothing about the person is shown to others in chat. */
export interface Person {
  subject: string;
}

interface Flow {
  id: IdentityProvider;
  configured(env: Env): boolean;
  authorizeUrl(env: Env, pending: Pending): string;
  person(env: Env, code: string, pending: Pending): Promise<Person>;
}

const url = (base: string, params: Record<string, string>) => `${base}?${new URLSearchParams(params)}`;

const challenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

async function readJson<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  if (!response.ok) throw new Error(`Provider answered ${response.status}`);
  return schema.parse(await response.json());
}

const postForm = (address: string, body: Record<string, string>) =>
  fetch(address, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });

const idTokenSchema = z.object({ id_token: z.string() });
const claimsSchema = z.object({ iss: z.string(), aud: z.string(), exp: z.number(), sub: z.string().min(1), nonce: z.string() });

/**
 * Who an ID token is about, after checking it is for us, current and from this sign-in.
 * Its signature is not checked: it came straight from the provider's token endpoint over TLS, in exchange for our
 * secret, which OpenID Connect allows (Core 1.0, 3.1.3.7). Never pass it a token from anywhere else, such as the browser.
 */
function readIdToken(token: string, issuers: string[], audience: string, nonce: string): Person {
  const claims = claimsSchema.parse(JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")));
  if (!issuers.includes(claims.iss) || claims.aud !== audience || claims.exp * 1000 <= Date.now() || claims.nonce !== nonce) {
    throw new Error("The ID token is not for this sign-in");
  }
  return { subject: claims.sub };
}

/** Apple takes a short-lived token signed with our key in place of a fixed secret. */
export function appleClientSecret(env: Env, now = Date.now()): string {
  const seconds = Math.floor(now / 1000);
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${part({ alg: "ES256", kid: env.APPLE_KEY_ID })}.${part({ iss: env.APPLE_TEAM_ID, iat: seconds, exp: seconds + 300, aud: "https://appleid.apple.com", sub: env.APPLE_CLIENT_ID })}`;
  // The key is often pasted into an env var on one line, with its line breaks written as \n.
  const key = String(env.APPLE_PRIVATE_KEY).replace(/\\n/g, "\n");
  return `${body}.${sign("sha256", Buffer.from(body), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}

const flows: Record<ProviderName, Flow> = {
  google: {
    id: "GOOGLE",
    configured: (env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    authorizeUrl: (env, pending) =>
      url("https://accounts.google.com/o/oauth2/v2/auth", {
        client_id: String(env.GOOGLE_CLIENT_ID),
        redirect_uri: pending.redirectUri,
        response_type: "code",
        scope: "openid",
        state: pending.state,
        nonce: pending.nonce,
        code_challenge: challenge(pending.verifier),
        code_challenge_method: "S256",
        prompt: "select_account",
      }),
    async person(env, code, pending) {
      const { id_token } = await readJson(
        await postForm("https://oauth2.googleapis.com/token", {
          code,
          client_id: String(env.GOOGLE_CLIENT_ID),
          client_secret: String(env.GOOGLE_CLIENT_SECRET),
          redirect_uri: pending.redirectUri,
          grant_type: "authorization_code",
          code_verifier: pending.verifier,
        }),
        idTokenSchema,
      );
      return readIdToken(id_token, ["https://accounts.google.com", "accounts.google.com"], String(env.GOOGLE_CLIENT_ID), pending.nonce);
    },
  },
  facebook: {
    id: "FACEBOOK",
    configured: (env) => Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET),
    authorizeUrl: (env, pending) =>
      url("https://www.facebook.com/v21.0/dialog/oauth", {
        client_id: String(env.FACEBOOK_APP_ID),
        redirect_uri: pending.redirectUri,
        response_type: "code",
        scope: "public_profile",
        state: pending.state,
      }),
    async person(env, code, pending) {
      const { access_token } = await readJson(
        await fetch(url("https://graph.facebook.com/v21.0/oauth/access_token", { client_id: String(env.FACEBOOK_APP_ID), client_secret: String(env.FACEBOOK_APP_SECRET), redirect_uri: pending.redirectUri, code })),
        z.object({ access_token: z.string() }),
      );
      // The proof ties the request to our app, so a token issued to another app is refused.
      const proof = createHmac("sha256", String(env.FACEBOOK_APP_SECRET)).update(access_token).digest("hex");
      const me = await readJson(
        await fetch(url("https://graph.facebook.com/v21.0/me", { fields: "id", access_token, appsecret_proof: proof })),
        z.object({ id: z.string().min(1) }),
      );
      return { subject: me.id };
    },
  },
  apple: {
    id: "APPLE",
    configured: (env) => Boolean(env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY),
    // No scope: asking for name or email makes Apple post the answer back across sites, which a Lax cookie does not
    // survive. The id is all a sign-in needs, as with the others.
    authorizeUrl: (env, pending) =>
      url("https://appleid.apple.com/auth/authorize", {
        client_id: String(env.APPLE_CLIENT_ID),
        redirect_uri: pending.redirectUri,
        response_type: "code",
        response_mode: "query",
        state: pending.state,
        nonce: pending.nonce,
      }),
    async person(env, code, pending) {
      const { id_token } = await readJson(
        await postForm("https://appleid.apple.com/auth/token", {
          code,
          client_id: String(env.APPLE_CLIENT_ID),
          client_secret: appleClientSecret(env),
          redirect_uri: pending.redirectUri,
          grant_type: "authorization_code",
        }),
        idTokenSchema,
      );
      return readIdToken(id_token, ["https://appleid.apple.com"], String(env.APPLE_CLIENT_ID), pending.nonce);
    },
  },
};

const readEnv = () => envSchema.parse(process.env);

/** The providers with their keys set, in button order. */
export function configuredProviders(): ProviderName[] {
  const env = readEnv();
  return providerNames.filter((name) => flows[name].configured(env));
}

/** A configured provider by its name in the address, or null. */
export function providerFlow(name: string) {
  const env = readEnv();
  const flow = (providerNames as readonly string[]).includes(name) ? flows[name as ProviderName] : null;
  if (!flow?.configured(env)) return null;
  return {
    id: flow.id,
    authorizeUrl: (pending: Pending) => flow.authorizeUrl(env, pending),
    person: (code: string, pending: Pending) => flow.person(env, code, pending),
  };
}
