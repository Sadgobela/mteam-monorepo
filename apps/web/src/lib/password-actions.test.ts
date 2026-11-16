import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@mteam/shared";

const db = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  claimEmailSend: vi.fn(),
  createResetToken: vi.fn(),
  resetPassword: vi.fn(),
  requestEmailChange: vi.fn(),
  changePassword: vi.fn(),
  verifyEmail: vi.fn(),
}));
const session = vi.hoisted(() => ({ startSession: vi.fn(), currentUser: vi.fn(), clientIp: vi.fn(), signInHere: vi.fn(), userAgent: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("./session", () => session);
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { sendEmail } from "./email";
import { changeEmailAction, changePasswordAction, confirmEmailAction, emailSignInAction, forgotPasswordAction, registerAction, resetPasswordAction } from "./password-actions";

const t = getDictionary("en");
const email = "ana@example.com";
const strong = "a long password";
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

beforeEach(() => {
  vi.resetAllMocks();
  log.mockImplementation(() => undefined);
  session.clientIp.mockResolvedValue("203.0.113.7");
  session.userAgent.mockResolvedValue("Firefox");
  session.currentUser.mockResolvedValue({ id: "u1" });
  db.claimEmailSend.mockResolvedValue(true);
});

afterEach(() => vi.unstubAllEnvs());

describe("sendEmail", () => {
  it("writes the message to the log", () => {
    sendEmail({ to: email, subject: "Hi", link: "https://example.com/x" });
    expect(log).toHaveBeenCalledWith(`[email] ${email}: Hi https://example.com/x`);
    vi.stubEnv("EMAIL_PROVIDER", "log");
    vi.stubEnv("NODE_ENV", "production");
    sendEmail({ to: email, subject: "Hi", link: "https://example.com/x" });
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("refuses to send in production without a provider, or with an unknown one", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => sendEmail({ to: email, subject: "Hi", link: "x" })).toThrow("EMAIL_PROVIDER is not set");
    vi.stubEnv("EMAIL_PROVIDER", "smtp");
    expect(() => sendEmail({ to: email, subject: "Hi", link: "x" })).toThrow();
    expect(log).not.toHaveBeenCalled();
  });

  it("stops registering, reset links and email changes before anything is made when no email can go out", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(registerAction({}, form({ locale: "en", email, password: strong }))).rejects.toThrow("EMAIL_PROVIDER is not set");
    await expect(forgotPasswordAction({}, form({ locale: "en", email }))).rejects.toThrow("EMAIL_PROVIDER is not set");
    await expect(changeEmailAction({}, form({ locale: "en", email }))).rejects.toThrow("EMAIL_PROVIDER is not set");
    expect(db.registerWithPassword).not.toHaveBeenCalled();
    expect(db.claimEmailSend).not.toHaveBeenCalled();
    expect(db.createResetToken).not.toHaveBeenCalled();
    expect(db.requestEmailChange).not.toHaveBeenCalled();
  });
});

describe("emailSignInAction", () => {
  it("signs in with a normalized email and goes back to the page it came from", async () => {
    db.signInWithPassword.mockResolvedValue({ token: "tok" });
    expect(await emailSignInAction({}, form({ locale: "ru", email: "  Ana@Example.COM ", password: "pw", next: "/ru/saved" }))).toEqual({ done: "/ru/saved" });
    expect(db.signInWithPassword).toHaveBeenCalledWith(email, "pw", "203.0.113.7", "Firefox");
    expect(session.startSession).toHaveBeenCalledWith("tok");
    expect(await emailSignInAction({}, form({ locale: "en", email, password: "pw", next: "//evil.example" }))).toEqual({ done: "/en" });
  });

  it("says what went wrong without starting a session", async () => {
    expect(await emailSignInAction({}, form({ locale: "en", email: "not-an-email", password: "pw" }))).toEqual({ error: "invalidEmail" });
    expect(await emailSignInAction({}, form({ locale: "en", email }))).toEqual({ error: "wrong" });
    expect(await emailSignInAction({}, form({ locale: "en", email, password: "x".repeat(129) }))).toEqual({ error: "wrong" });
    expect(db.signInWithPassword).not.toHaveBeenCalled();
    db.signInWithPassword.mockResolvedValue({ error: "limited" });
    expect(await emailSignInAction({}, form({ locale: "en", email, password: "pw" }))).toEqual({ error: "limited" });
    expect(session.startSession).not.toHaveBeenCalled();
  });
});

describe("registerAction", () => {
  it("creates the account, emails the confirmation link and signs in", async () => {
    db.registerWithPassword.mockResolvedValue({ token: "tok", verifyToken: "vt" });
    expect(await registerAction({}, form({ locale: "ka", email, password: strong, next: "/ka/listings/new" }))).toEqual({ done: "/ka/listings/new" });
    expect(db.registerWithPassword).toHaveBeenCalledWith(email, strong, "203.0.113.7", "Firefox");
    expect(log).toHaveBeenCalledWith(`[email] ${email}: ${getDictionary("ka").auth.mail.verifySubject} http://localhost:3111/ka/auth/verify?token=vt`);
    expect(db.claimEmailSend).toHaveBeenCalledWith("203.0.113.7", email, "VERIFY");
    expect(session.startSession).toHaveBeenCalledWith("tok");
  });

  it("still opens the account, without the email, when too many emails went out", async () => {
    db.registerWithPassword.mockResolvedValue({ token: "tok", verifyToken: "vt" });
    db.claimEmailSend.mockResolvedValue(false);
    expect(await registerAction({}, form({ locale: "en", email, password: strong }))).toEqual({ done: "/en" });
    expect(log).not.toHaveBeenCalled();
    expect(session.startSession).toHaveBeenCalledWith("tok");
  });

  it("refuses a bad email, a short password or one made of a single character", async () => {
    expect(await registerAction({}, form({ locale: "en", email: "x@", password: strong }))).toEqual({ error: "invalidEmail" });
    expect(await registerAction({}, form({ locale: "en", email, password: "short" }))).toEqual({ error: "weakPassword" });
    expect(await registerAction({}, form({ locale: "en", email, password: "aaaaaaaaaaaa" }))).toEqual({ error: "weakPassword" });
    expect(db.registerWithPassword).not.toHaveBeenCalled();
  });

  it("says when the email has an account", async () => {
    db.registerWithPassword.mockResolvedValue({ error: "taken" });
    expect(await registerAction({}, form({ locale: "en", email, password: strong }))).toEqual({ error: "taken" });
    expect(log).not.toHaveBeenCalled();
    expect(session.startSession).not.toHaveBeenCalled();
  });
});

describe("forgotPasswordAction", () => {
  it("sends a reset link to an account's email and gives the same answer for an unknown one", async () => {
    db.createResetToken.mockResolvedValueOnce("rt").mockResolvedValueOnce(null);
    expect(await forgotPasswordAction({}, form({ locale: "en", email }))).toEqual({ notice: "linkSent" });
    expect(db.claimEmailSend).toHaveBeenCalledWith("203.0.113.7", email, "RESET");
    expect(log).toHaveBeenCalledWith(`[email] ${email}: ${t.auth.mail.resetSubject} http://localhost:3111/en/auth/reset?token=rt`);
    expect(await forgotPasswordAction({}, form({ locale: "en", email }))).toEqual({ notice: "linkSent" });
    expect(log).toHaveBeenCalledOnce();
  });

  it("refuses a bad email and stops when too many links went out", async () => {
    expect(await forgotPasswordAction({}, form({ locale: "en", email: "nope" }))).toEqual({ error: "invalidEmail" });
    db.claimEmailSend.mockResolvedValue(false);
    expect(await forgotPasswordAction({}, form({ locale: "en", email }))).toEqual({ error: "limited" });
    expect(db.createResetToken).not.toHaveBeenCalled();
  });
});

describe("resetPasswordAction", () => {
  it("sets the password and signs in fresh", async () => {
    db.resetPassword.mockResolvedValue("tok");
    expect(await resetPasswordAction({}, form({ locale: "en", token: "rt", password: strong }))).toEqual({ done: "/en/account/security" });
    expect(db.resetPassword).toHaveBeenCalledWith("rt", strong, "Firefox");
    expect(session.startSession).toHaveBeenCalledWith("tok");
  });

  it("refuses a weak password, a missing token and a used link", async () => {
    expect(await resetPasswordAction({}, form({ locale: "en", token: "rt", password: "short" }))).toEqual({ error: "weakPassword" });
    expect(await resetPasswordAction({}, form({ locale: "en", password: strong }))).toEqual({ error: "badLink" });
    expect(db.resetPassword).not.toHaveBeenCalled();
    db.resetPassword.mockResolvedValue(null);
    expect(await resetPasswordAction({}, form({ locale: "en", token: "rt", password: strong }))).toEqual({ error: "badLink" });
    expect(session.startSession).not.toHaveBeenCalled();
  });
});

describe("confirmEmailAction", () => {
  it("sends someone signed out to sign in, leaving the link unused", async () => {
    session.currentUser.mockResolvedValue(null);
    session.signInHere.mockResolvedValue("/en/login");
    await expect(confirmEmailAction({}, form({ locale: "en", token: "vt" }))).rejects.toThrow("REDIRECT /en/login");
    expect(db.verifyEmail).not.toHaveBeenCalled();
  });

  it("confirms for the signed-in account and says what went wrong otherwise", async () => {
    db.verifyEmail.mockResolvedValueOnce("verified").mockResolvedValueOnce("otherUser").mockResolvedValueOnce("taken").mockResolvedValueOnce("invalid");
    expect(await confirmEmailAction({}, form({ locale: "en", token: "vt" }))).toEqual({ notice: "emailConfirmed" });
    expect(db.verifyEmail).toHaveBeenCalledWith("vt", "u1");
    expect(await confirmEmailAction({}, form({ locale: "en", token: "vt" }))).toEqual({ error: "otherAccount" });
    expect(await confirmEmailAction({}, form({ locale: "en", token: "vt" }))).toEqual({ error: "taken" });
    expect(await confirmEmailAction({}, form({ locale: "en", token: "vt" }))).toEqual({ error: "badLink" });
    expect(await confirmEmailAction({}, form({ locale: "en" }))).toEqual({ error: "badLink" });
    expect(db.verifyEmail).toHaveBeenCalledTimes(4);
  });
});

describe("changeEmailAction", () => {
  it("sends someone signed out to sign in", async () => {
    session.currentUser.mockResolvedValue(null);
    session.signInHere.mockResolvedValue("/en/login?next=%2Fen%2Faccount%2Fsecurity");
    await expect(changeEmailAction({}, form({ locale: "en", email }))).rejects.toThrow("REDIRECT /en/login?next=%2Fen%2Faccount%2Fsecurity");
    expect(db.requestEmailChange).not.toHaveBeenCalled();
  });

  it("emails a confirmation link to the new address, passing the password on", async () => {
    db.requestEmailChange.mockResolvedValue({ token: "vt" });
    expect(await changeEmailAction({}, form({ locale: "en", email: "New@Example.com", current: "the password" }))).toEqual({ notice: "verifySent" });
    expect(db.requestEmailChange).toHaveBeenCalledWith("u1", "new@example.com", "the password");
    expect(db.claimEmailSend).toHaveBeenCalledWith("203.0.113.7", "new@example.com", "VERIFY");
    expect(log).toHaveBeenCalledWith(`[email] new@example.com: ${t.auth.mail.verifySubject} http://localhost:3111/en/auth/verify?token=vt`);
    expect(await changeEmailAction({}, form({ locale: "en", email }))).toEqual({ notice: "verifySent" });
    expect(db.requestEmailChange).toHaveBeenLastCalledWith("u1", email, "");
  });

  it("refuses a bad or taken address, a wrong password, and stops when too many links went out", async () => {
    expect(await changeEmailAction({}, form({ locale: "en", email: "bad" }))).toEqual({ error: "invalidEmail" });
    expect(await changeEmailAction({}, form({ locale: "en", email, current: "x".repeat(129) }))).toEqual({ error: "wrongCurrent" });
    db.requestEmailChange.mockResolvedValueOnce({ error: "taken" }).mockResolvedValueOnce({ error: "wrong" }).mockResolvedValueOnce({ error: "limited" });
    expect(await changeEmailAction({}, form({ locale: "en", email }))).toEqual({ error: "taken" });
    expect(await changeEmailAction({}, form({ locale: "en", email, current: "nope" }))).toEqual({ error: "wrongCurrent" });
    expect(await changeEmailAction({}, form({ locale: "en", email, current: "nope" }))).toEqual({ error: "limited" });
    db.claimEmailSend.mockResolvedValue(false);
    expect(await changeEmailAction({}, form({ locale: "en", email }))).toEqual({ error: "limited" });
    expect(db.requestEmailChange).toHaveBeenCalledTimes(3);
    expect(log).not.toHaveBeenCalled();
  });
});

describe("changePasswordAction", () => {
  it("sends someone signed out to sign in", async () => {
    session.currentUser.mockResolvedValue(null);
    session.signInHere.mockResolvedValue("/en/login");
    await expect(changePasswordAction({}, form({ locale: "en", password: strong }))).rejects.toThrow("REDIRECT /en/login");
  });

  it("sets a first password, or changes one with the current one, and keeps this device signed in", async () => {
    db.changePassword.mockResolvedValue({ token: "tok" });
    expect(await changePasswordAction({}, form({ locale: "en", password: strong }))).toEqual({ notice: "passwordSaved" });
    expect(db.changePassword).toHaveBeenCalledWith("u1", "", strong, "Firefox");
    expect(await changePasswordAction({}, form({ locale: "en", current: "old one", password: strong }))).toEqual({ notice: "passwordSaved" });
    expect(db.changePassword).toHaveBeenLastCalledWith("u1", "old one", strong, "Firefox");
    expect(session.startSession).toHaveBeenCalledWith("tok");
  });

  it("says what went wrong", async () => {
    expect(await changePasswordAction({}, form({ locale: "en", password: "short" }))).toEqual({ error: "weakPassword" });
    expect(await changePasswordAction({}, form({ locale: "en", current: "x".repeat(129), password: strong }))).toEqual({ error: "wrongCurrent" });
    expect(db.changePassword).not.toHaveBeenCalled();
    db.changePassword.mockResolvedValueOnce({ error: "wrong" }).mockResolvedValueOnce({ error: "limited" });
    expect(await changePasswordAction({}, form({ locale: "en", current: "nope", password: strong }))).toEqual({ error: "wrongCurrent" });
    expect(await changePasswordAction({}, form({ locale: "en", current: "nope", password: strong }))).toEqual({ error: "limited" });
    expect(session.startSession).not.toHaveBeenCalled();
  });
});
