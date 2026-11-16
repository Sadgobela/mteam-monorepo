import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getDictionary } from "@mteam/shared";

const db = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  claimEmailSend: vi.fn(),
  createResetToken: vi.fn(),
  resetPassword: vi.fn(),
  requestEmailChange: vi.fn(),
  verifyEmail: vi.fn(),
  isResetTokenOpen: vi.fn(),
  getAccountSecurity: vi.fn(),
}));
const session = vi.hoisted(() => ({ startSession: vi.fn(), currentUser: vi.fn(), hasSession: vi.fn(), clientIp: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("next/navigation", () => ({
  usePathname: () => "/en",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { EmailLoginForm } from "@/components/AuthForms";
import { LoginPanel } from "@/components/LoginPanel";
import SecurityPage from "./[locale]/(account)/account/security/page";
import ResetPasswordPage from "./[locale]/auth/reset/page";
import VerifyEmailPage from "./[locale]/auth/verify/page";

const t = getDictionary("en");
const email = "ana@example.com";
const strong = "a long password";
const params = Promise.resolve({ locale: "en" });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  session.clientIp.mockResolvedValue("203.0.113.7");
  session.currentUser.mockResolvedValue({ id: "u1" });
  session.hasSession.mockResolvedValue(false);
  db.claimEmailSend.mockResolvedValue(true);
});

afterEach(() => vi.unstubAllGlobals());

describe("email sign-in form", () => {
  it("is a tab of the sign-in panel next to the phone", async () => {
    const user = userEvent.setup();
    render(<LoginPanel locale="en" t={t} next="/en/saved" />);
    expect(screen.getByLabelText(t.login.phone)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: t.auth.tabs.email }));
    expect(await screen.findByLabelText(t.auth.email, { selector: "input" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.auth.forgot })).toHaveAttribute("href", "/en/auth/reset");
  });

  it("shows a wrong password, then signs in and opens the page it came from", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    db.signInWithPassword.mockResolvedValueOnce({ error: "wrong" }).mockResolvedValueOnce({ token: "tok" });
    render(<EmailLoginForm locale="en" t={t} next="/en/saved" />);

    await user.type(screen.getByLabelText(t.auth.email), email);
    await user.type(screen.getByLabelText(t.auth.password), "wrong password");
    await user.click(screen.getByRole("button", { name: t.auth.signIn }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.auth.errors.wrong);
    // What was typed stays, to be corrected.
    expect(screen.getByLabelText(t.auth.email)).toHaveValue(email);

    await user.click(screen.getByRole("button", { name: t.auth.signIn }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/en/saved"));
  });

  it("switches to creating an account, with the password rule, and back", async () => {
    const user = userEvent.setup();
    db.registerWithPassword.mockResolvedValue({ error: "taken" });
    render(<EmailLoginForm locale="en" t={t} />);

    await user.click(screen.getByRole("button", { name: t.auth.toRegister }));
    expect(screen.getByText(t.auth.passwordHint)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: t.auth.forgot })).toBeNull();
    await user.type(screen.getByLabelText(t.auth.email), email);
    await user.type(screen.getByLabelText(t.auth.password), strong);
    await user.click(screen.getByRole("button", { name: t.auth.register }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.auth.errors.taken);
    expect(db.registerWithPassword).toHaveBeenCalledWith(email, strong, "203.0.113.7");

    await user.click(screen.getByRole("button", { name: t.auth.toSignIn }));
    expect(screen.getByRole("button", { name: t.auth.signIn })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("VerifyEmailPage", () => {
  const page = async (token?: string | string[]) => render(await VerifyEmailPage({ params, searchParams: Promise.resolve({ token }) }));

  it("confirms the email from the link", async () => {
    db.verifyEmail.mockResolvedValue("verified");
    await page("vt");
    expect(db.verifyEmail).toHaveBeenCalledWith("vt");
    expect(screen.getByRole("status")).toHaveTextContent(t.auth.verified);
    expect(screen.getByRole("link", { name: t.auth.toSecurity })).toHaveAttribute("href", "/en/account/security");
  });

  it("says when the address was taken meanwhile", async () => {
    db.verifyEmail.mockResolvedValue("taken");
    await page("vt");
    expect(screen.getByRole("alert")).toHaveTextContent(t.auth.errors.taken);
  });

  it("refuses a bad, missing or doubled token", async () => {
    db.verifyEmail.mockResolvedValue("invalid");
    await page("vt");
    expect(screen.getByRole("alert")).toHaveTextContent(t.auth.errors.badLink);
    for (const token of [undefined, ["a", "b"]]) {
      await page(token);
    }
    expect(db.verifyEmail).toHaveBeenCalledOnce();
  });
});

describe("ResetPasswordPage", () => {
  const page = async (token?: string) => render(await ResetPasswordPage({ params, searchParams: Promise.resolve({ token }) }));

  it("asks for an email to send a link to", async () => {
    const user = userEvent.setup();
    db.createResetToken.mockResolvedValue(null);
    await page();
    expect(screen.getByRole("heading", { name: t.auth.forgotHeading })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    await user.type(screen.getByLabelText(t.auth.email), email);
    await user.click(screen.getByRole("button", { name: t.auth.sendLink }));
    expect(await screen.findByRole("status")).toHaveTextContent(t.auth.notices.linkSent);
  });

  it("says when a link has run out, and offers a new one", async () => {
    db.isResetTokenOpen.mockResolvedValue(false);
    await page("old");
    expect(screen.getByRole("alert")).toHaveTextContent(t.auth.errors.badLink);
    expect(screen.getByRole("button", { name: t.auth.sendLink })).toBeInTheDocument();
  });

  it("takes a new password from an open link and signs in", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    db.isResetTokenOpen.mockResolvedValue(true);
    db.resetPassword.mockResolvedValue("tok");
    await page("rt");
    expect(db.isResetTokenOpen).toHaveBeenCalledWith("rt");
    await user.type(screen.getByLabelText(t.auth.newPassword), strong);
    await user.click(screen.getByRole("button", { name: t.auth.savePassword }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/en/account/security"));
    expect(db.resetPassword).toHaveBeenCalledWith("rt", strong);
  });
});

describe("SecurityPage", () => {
  const security = { email, emailVerified: false, hasPassword: true, phone: "+995555123456", providers: ["GOOGLE"] };

  it("sends a visitor to sign in", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(SecurityPage({ params })).rejects.toThrow("REDIRECT /en/login?next=%2Fen%2Faccount%2Fsecurity");
  });

  it("shows the email, a resend link, the password change and the ways to sign in", async () => {
    const user = userEvent.setup();
    db.getAccountSecurity.mockResolvedValue(security);
    db.requestEmailChange.mockResolvedValue({ token: "vt" });
    render(await SecurityPage({ params }));
    expect(db.getAccountSecurity).toHaveBeenCalledWith("u1");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t.auth.security.heading);
    expect(screen.getByText(t.auth.security.unverifiedTag)).toBeInTheDocument();
    // Both the email change and the password change ask for the current password.
    expect(screen.getAllByLabelText(t.auth.currentPassword)).toHaveLength(2);
    expect(screen.getByRole("button", { name: t.auth.security.changePassword })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.auth.security.changeEmail })).toBeInTheDocument();

    const methods = screen.getAllByRole("listitem");
    expect(methods.map((item) => item.textContent)).toEqual([
      `${t.auth.security.methods.phone}+995555123456${t.auth.security.inUse}`,
      `${t.auth.security.methods.google}${t.auth.security.inUse}`,
      `${t.auth.security.methods.facebook}${t.auth.security.notInUse}`,
      `${t.auth.security.methods.apple}${t.auth.security.notInUse}`,
      `${t.auth.security.methods.email}${t.auth.security.inUse}`,
    ]);

    await user.click(screen.getByRole("button", { name: t.auth.security.resend }));
    expect(await screen.findByRole("status")).toHaveTextContent(t.auth.notices.verifySent);
    expect(db.requestEmailChange).toHaveBeenCalledWith("u1", email, "");
  });

  it("marks a confirmed email and offers no resend", async () => {
    db.getAccountSecurity.mockResolvedValue({ ...security, emailVerified: true, hasPassword: false });
    render(await SecurityPage({ params }));
    expect(screen.getByText(t.auth.security.verifiedTag)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.auth.security.resend })).toBeNull();
    expect(screen.queryByLabelText(t.auth.currentPassword)).toBeNull();
    expect(screen.getByRole("button", { name: t.auth.security.setPassword })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[4]).toHaveTextContent(t.auth.security.notInUse);
  });

  it("asks an account without an email to add one before a password", async () => {
    db.getAccountSecurity.mockResolvedValue({ email: null, emailVerified: false, hasPassword: false, phone: null, providers: ["APPLE", "FACEBOOK"] });
    render(await SecurityPage({ params }));
    expect(screen.getByText(t.auth.security.noEmail)).toBeInTheDocument();
    expect(screen.getByText(t.auth.security.needEmail)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.auth.security.addEmail })).toBeInTheDocument();
    expect(screen.queryByLabelText(t.auth.newPassword)).toBeNull();
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent(t.auth.security.notInUse);
  });
});
