import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getDictionary } from "@mteam/shared";

const db = vi.hoisted(() => ({ requestLoginCode: vi.fn(), verifyLoginCode: vi.fn() }));
const session = vi.hoisted(() => ({ startSession: vi.fn(), endSession: vi.fn(), currentUser: vi.fn(), hasSession: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { Header } from "@/components/Header";
import { LoginForm } from "@/components/LoginForm";
import { loginAction, logoutAction } from "@/lib/auth-actions";
import LoginPage from "./[locale]/login/page";

const t = getDictionary("en");
const phone = "+995555123456";
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => vi.resetAllMocks());

describe("loginAction", () => {
  it("goes back to the phone step on request", async () => {
    expect(await loginAction({ phone }, form({ change: "1", phone, code: "" }))).toEqual({});
    expect(db.verifyLoginCode).not.toHaveBeenCalled();
  });

  it("rejects a non-Georgian number without sending", async () => {
    expect(await loginAction({}, form({ phone: "+971501234567" }))).toEqual({ error: "invalidPhone" });
    expect(db.requestLoginCode).not.toHaveBeenCalled();
  });

  it("sends a code to the normalized number", async () => {
    db.requestLoginCode.mockResolvedValue(true);
    expect(await loginAction({}, form({ phone: "555 12 34 56" }))).toEqual({ phone });
    expect(db.requestLoginCode).toHaveBeenCalledWith(phone);
  });

  it("still asks for the code when one was just sent", async () => {
    db.requestLoginCode.mockResolvedValue(false);
    expect(await loginAction({}, form({ phone }))).toEqual({ phone, error: "tooSoon" });
  });

  it("reports a wrong code and starts no session", async () => {
    db.verifyLoginCode.mockResolvedValue(null);
    expect(await loginAction({ phone }, form({ phone, code: "000000", locale: "en" }))).toEqual({
      phone,
      error: "wrongCode",
    });
    expect(session.startSession).not.toHaveBeenCalled();
  });

  it("signs in and goes to the posting form", async () => {
    db.verifyLoginCode.mockResolvedValue("tok");
    await expect(loginAction({ phone }, form({ phone, code: "123456", locale: "ru" }))).rejects.toThrow(
      "REDIRECT /ru/listings/new",
    );
    expect(db.verifyLoginCode).toHaveBeenCalledWith(phone, "123456");
    expect(session.startSession).toHaveBeenCalledWith("tok");
  });
});

describe("logoutAction", () => {
  it("ends the session and goes home", async () => {
    await expect(logoutAction(form({ locale: "ka" }))).rejects.toThrow("REDIRECT /ka");
    expect(session.endSession).toHaveBeenCalled();
  });
});

describe("LoginForm", () => {
  it("walks from phone to code and shows errors", async () => {
    const user = userEvent.setup();
    db.requestLoginCode.mockResolvedValue(true);
    db.verifyLoginCode.mockResolvedValue(null);
    render(<LoginForm locale="en" t={t} />);

    await user.type(screen.getByLabelText("Mobile number"), "555123456");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(await screen.findByText(/\+995555123456/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("SMS code"), "000000");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(t.login.errors.wrongCode);
    // jsdom does not report which button submitted a form, so the action itself covers the "change" branch.
    expect(screen.getByRole("button", { name: "Change number" })).toHaveAttribute("name", "change");
  });
});

describe("LoginPage", () => {
  const params = Promise.resolve({ locale: "en" });

  it("shows the form to a visitor", async () => {
    session.currentUser.mockResolvedValue(null);
    render(await LoginPage({ params }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t.login.title);
  });

  it("sends a signed-in user on to the posting form", async () => {
    session.currentUser.mockResolvedValue({ id: "u1" });
    await expect(LoginPage({ params })).rejects.toThrow("REDIRECT /en/listings/new");
  });
});

describe("Header account links", () => {
  it("offers sign-in to a visitor", () => {
    render(<Header locale="en" t={t} signedIn={false} />);
    expect(screen.getByRole("link", { name: t.nav.login })).toHaveAttribute("href", "/en/login");
    expect(screen.getByRole("link", { name: t.nav.post })).toHaveAttribute("href", "/en/listings/new");
    expect(screen.queryByRole("button", { name: t.nav.logout })).toBeNull();
  });

  it("offers sign-out when signed in", () => {
    render(<Header locale="en" t={t} signedIn />);
    expect(screen.getByRole("button", { name: t.nav.logout })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: t.nav.login })).toBeNull();
  });
});
