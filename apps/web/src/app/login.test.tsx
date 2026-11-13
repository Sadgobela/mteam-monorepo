import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getDictionary } from "@mteam/shared";

const db = vi.hoisted(() => ({ requestLoginCode: vi.fn(), verifyLoginCode: vi.fn() }));
const router = vi.hoisted(() => ({ back: vi.fn() }));
const nav = vi.hoisted(() => ({ query: "deal=sale" }));
const session = vi.hoisted(() => ({ startSession: vi.fn(), endSession: vi.fn(), currentUser: vi.fn(), hasSession: vi.fn(), clientIp: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("next/navigation", () => ({
  usePathname: () => "/en",
  useSearchParams: () => new URLSearchParams(nav.query),
  useRouter: () => router,
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
import { loginPath, safeNext } from "@/lib/login-path";
import LoginOverlay from "./[locale]/@modal/(.)login/page";
import NoModal from "./[locale]/@modal/default";
import OtherNoModal from "./[locale]/@modal/[...rest]/page";
import HomeNoModal from "./[locale]/@modal/page";
import LoginPage from "./[locale]/login/page";

const t = getDictionary("en");
const phone = "+995555123456";
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.resetAllMocks();
  session.clientIp.mockResolvedValue("203.0.113.7");
});

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
    expect(db.requestLoginCode).toHaveBeenCalledWith(phone, "203.0.113.7");
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

  it("signs in and goes back to the page it came from", async () => {
    db.verifyLoginCode.mockResolvedValue("tok");
    expect(await loginAction({ phone }, form({ phone, code: "123456", locale: "ru", next: "/ru/saved" }))).toEqual({ done: "/ru/saved" });
    expect(db.verifyLoginCode).toHaveBeenCalledWith(phone, "123456");
    expect(session.startSession).toHaveBeenCalledWith("tok");
  });

  it("goes home instead of to another site", async () => {
    db.verifyLoginCode.mockResolvedValue("tok");
    expect(await loginAction({ phone }, form({ phone, code: "123456", locale: "ru", next: "//evil.example" }))).toEqual({ done: "/ru" });
    expect(await loginAction({ phone }, form({ phone, code: "123456", locale: "en" }))).toEqual({ done: "/en" });
  });
});

describe("logoutAction", () => {
  it("ends the session and goes home", async () => {
    await expect(logoutAction(form({ locale: "ka" }))).rejects.toThrow("REDIRECT /ka");
    expect(session.endSession).toHaveBeenCalled();
  });
});

describe("safeNext", () => {
  it("keeps our own pages and drops everything else", () => {
    expect(safeNext("/ka/listings/5?x=1", "en")).toBe("/ka/listings/5?x=1");
    expect(safeNext("/ru", "en")).toBe("/ru");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "/en//evil.example", "/fr/x", "/enx", "/en x", "/en\t/x", "/en/ქ", "/en@evil.example", undefined, 5]) {
      expect(safeNext(bad, "en")).toBe("/en");
    }
    expect(loginPath("ka", "/ka/saved?a=1&b=2")).toBe("/ka/login?next=%2Fka%2Fsaved%3Fa%3D1%26b%3D2");
  });
});

describe("LoginForm", () => {
  it("walks from phone to code, signs in on the sixth digit and shows errors", async () => {
    const user = userEvent.setup();
    db.requestLoginCode.mockResolvedValue(true);
    db.verifyLoginCode.mockResolvedValue(null);
    render(<LoginForm locale="en" t={t} next="/en/saved" />);

    await user.type(screen.getByLabelText("Mobile number"), "555123456");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(await screen.findByText(/\+995555123456/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    const cells = screen.getAllByRole("textbox");
    await user.type(cells[0], "0a00000");

    expect(await screen.findByRole("alert")).toHaveTextContent(t.login.errors.wrongCode);
    expect(db.verifyLoginCode).toHaveBeenCalledWith(phone, "000000");
    expect(screen.getByRole("group", { name: "SMS code" })).toBeInTheDocument();
    // jsdom does not report which button submitted a form, so the action itself covers the "change" branch.
    expect(screen.getByRole("button", { name: "Change number" })).toHaveAttribute("name", "change");
  });

  it("loads the page it came from once signed in", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    db.requestLoginCode.mockResolvedValue(true);
    db.verifyLoginCode.mockResolvedValue("tok");
    render(<LoginForm locale="en" t={t} next="/en/saved" />);

    await user.type(screen.getByLabelText("Mobile number"), "555123456");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await user.type((await screen.findAllByRole("textbox"))[0], "123456");

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/en/saved"));
    vi.unstubAllGlobals();
  });
});

describe("LoginPage", () => {
  const params = Promise.resolve({ locale: "en" });
  const searchParams = Promise.resolve({ next: "/en/saved" });

  it("shows the form and what signing in is for", async () => {
    session.currentUser.mockResolvedValue(null);
    const { container } = render(await LoginPage({ params, searchParams }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t.login.title);
    for (const perk of t.login.perks) expect(screen.getByText(perk)).toBeInTheDocument();
    expect(container.querySelector('input[name="next"]')).toHaveValue("/en/saved");
    expect(screen.queryByRole("link", { name: t.nav.login })).toBeNull();
  });

  it("sends a signed-in user on to where they were going", async () => {
    session.currentUser.mockResolvedValue({ id: "u1" });
    await expect(LoginPage({ params, searchParams })).rejects.toThrow("REDIRECT /en/saved");
  });
});

describe("LoginOverlay", () => {
  const params = Promise.resolve({ locale: "en" });

  it("opens over the page and closes back to it", async () => {
    session.currentUser.mockResolvedValue(null);
    render(await LoginOverlay({ params, searchParams: Promise.resolve({ next: "/en/listings/7" }) }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(t.login.title);
    expect(screen.getByRole("heading", { level: 2, name: t.login.title })).toBeInTheDocument();
    expect(document.querySelector('input[name="next"]')).toHaveValue("/en/listings/7");
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(router.back).toHaveBeenCalled();
  });

  it("leaves every other page without a modal", () => {
    expect(NoModal()).toBeNull();
    expect(HomeNoModal()).toBeNull();
    expect(OtherNoModal()).toBeNull();
  });
});

describe("Header account links", () => {
  it("offers sign-in to a visitor", () => {
    render(<Header locale="en" t={t} signedIn={false} />);
    expect(screen.getByRole("link", { name: t.nav.login })).toHaveAttribute("href", "/en/login?next=%2Fen%3Fdeal%3Dsale");
    expect(screen.getByRole("link", { name: t.nav.post })).toHaveAttribute("href", "/en/listings/new");
    expect(screen.queryByRole("button", { name: t.nav.logout })).toBeNull();
  });

  it("comes back to a page without a query as it was", () => {
    nav.query = "";
    render(<Header locale="en" t={t} signedIn={false} />);
    expect(screen.getByRole("link", { name: t.nav.login })).toHaveAttribute("href", "/en/login?next=%2Fen");
    nav.query = "deal=sale";
  });

  it("offers sign-out when signed in", () => {
    render(<Header locale="en" t={t} signedIn />);
    expect(screen.getByRole("button", { name: t.nav.logout })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: t.nav.login })).toBeNull();
  });
});
