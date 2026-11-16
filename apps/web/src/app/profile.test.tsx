import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getDictionary } from "@mteam/shared";

const db = vi.hoisted(() => ({ completeOnboarding: vi.fn(), updateProfile: vi.fn(), getProfile: vi.fn() }));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), hasSession: vi.fn(), signInHere: vi.fn() }));
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("next/cache", () => cache);
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/saved",
  useSearchParams: () => null,
  useRouter: () => router,
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { Avatar } from "@/components/Avatar";
import { AvatarUpload } from "@/components/ProfileForms";
import { onboardingNext, onboardingPath, pathAfterSignIn } from "@/lib/onboarding";
import { onboardAction, saveProfileAction } from "@/lib/profile-actions";
import AccountLayout from "./[locale]/(account)/layout";
import ProfilePage from "./[locale]/(account)/account/profile/page";
import OnboardingPage from "./[locale]/onboarding/page";

const t = getDictionary("en");
const params = Promise.resolve({ locale: "en" as string });
const newUser = { id: "u1", name: null, onboardedAt: null };
const settled = { id: "u1", name: "Nino", onboardedAt: new Date() };
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ locale: "en", ...fields })) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.resetAllMocks();
  session.signInHere.mockResolvedValue("/en/login?next=%2Fen%2Fhere");
});

describe("where sign-in continues", () => {
  it("asks a new account the first-visit questions first, keeping the page", () => {
    expect(pathAfterSignIn({ onboardedAt: null }, "/en/saved?x=1", "en")).toBe("/en/onboarding?next=%2Fen%2Fsaved%3Fx%3D1");
    expect(pathAfterSignIn({ onboardedAt: new Date() }, "/en/saved", "en")).toBe("/en/saved");
    expect(pathAfterSignIn(null, "/en/saved", "en")).toBe("/en/saved");
  });

  it("lets a broker invite and onboarding itself through", () => {
    expect(pathAfterSignIn({ onboardedAt: null }, "/ka/invite/abc", "ka")).toBe("/ka/invite/abc");
    expect(pathAfterSignIn({ onboardedAt: null }, "/en/onboarding?next=%2Fen", "en")).toBe("/en/onboarding?next=%2Fen");
  });

  it("never continues from onboarding to onboarding, or to another site", () => {
    expect(onboardingNext("/en/onboarding", "en")).toBe("/en");
    expect(onboardingNext("/ru/onboarding?next=%2Fru", "ru")).toBe("/ru");
    expect(onboardingNext("//evil.example", "en")).toBe("/en");
    expect(onboardingNext("/en/onboardings", "en")).toBe("/en/onboardings");
    expect(onboardingPath("ka", "/ka")).toBe("/ka/onboarding?next=%2Fka");
  });
});

describe("onboardAction", () => {
  const answers = { name: "  Nino  ", intent: "BROKER", terms: "on", next: "/en/saved" };

  it("saves the answers and the terms, then continues, without making anyone a broker", async () => {
    session.currentUser.mockResolvedValue(newUser);
    await expect(onboardAction({}, form(answers))).rejects.toThrow("REDIRECT /en/saved");
    expect(db.completeOnboarding).toHaveBeenCalledWith("u1", { name: "Nino", intent: "BROKER" });
  });

  it.each([
    ["a one-letter name", { name: "N" }],
    ["a name over 60 characters", { name: "N".repeat(61) }],
    ["a name of spaces", { name: "     " }],
    ["a hidden character", { name: "Ni​no" }],
    ["no intent", { intent: "" }],
    ["an unknown intent", { intent: "ADMIN" }],
    ["the terms not accepted", { terms: "" }],
  ])("refuses %s", async (_, change) => {
    session.currentUser.mockResolvedValue(newUser);
    expect(await onboardAction({}, form({ ...answers, ...change }))).toEqual({ invalid: true });
    expect(db.completeOnboarding).not.toHaveBeenCalled();
  });

  it("sends a visitor to sign in, coming back here", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(onboardAction({}, form(answers))).rejects.toThrow(`REDIRECT /en/login?next=${encodeURIComponent("/en/onboarding?next=%2Fen%2Fsaved")}`);
  });

  it("keeps the first answers when they were given in another tab", async () => {
    session.currentUser.mockResolvedValue(settled);
    await expect(onboardAction({}, form(answers))).rejects.toThrow("REDIRECT /en/saved");
    expect(db.completeOnboarding).not.toHaveBeenCalled();
  });
});

describe("saveProfileAction", () => {
  it("saves the name and intent and refreshes the page", async () => {
    session.currentUser.mockResolvedValue(settled);
    expect(await saveProfileAction({}, form({ name: "Nino B", intent: "OWNER" }))).toEqual({ saved: true });
    expect(db.updateProfile).toHaveBeenCalledWith("u1", { name: "Nino B", intent: "OWNER" });
    expect(cache.revalidatePath).toHaveBeenCalledWith("/en/account/profile");
  });

  it("refuses a bad name, and sends a visitor to sign in", async () => {
    session.currentUser.mockResolvedValue(settled);
    expect(await saveProfileAction({}, form({ name: "", intent: "OWNER" }))).toEqual({ invalid: true });
    session.currentUser.mockResolvedValue(null);
    await expect(saveProfileAction({}, form({ name: "Nino", intent: "OWNER" }))).rejects.toThrow("REDIRECT /en/login?next=%2Fen%2Fhere");
    expect(db.updateProfile).not.toHaveBeenCalled();
  });
});

describe("OnboardingPage", () => {
  const open = (next?: string) => OnboardingPage({ params, searchParams: Promise.resolve({ next }) });

  it("welcomes a new account, and says MTeam will call a broker", async () => {
    session.currentUser.mockResolvedValue(newUser);
    render(await open("/en/saved"));
    expect(screen.getByRole("heading", { name: t.profile.welcome })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: t.profile.name })).toHaveValue("");
    expect(document.querySelector<HTMLInputElement>("input[name=next]")?.value).toBe("/en/saved");
    expect(screen.queryByText(t.profile.brokerNote)).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: t.profile.intents.BROKER }));
    expect(screen.getByText(t.profile.brokerNote)).toBeInTheDocument();
    expect(document.querySelector<HTMLInputElement>("input[name=intent]")?.value).toBe("BROKER");
  });

  it("says what is missing when the answers are refused", async () => {
    const user = userEvent.setup();
    session.currentUser.mockResolvedValue(newUser);
    render(await open());
    await user.type(screen.getByRole("textbox", { name: t.profile.name }), "Nino");
    await user.click(screen.getByRole("checkbox", { name: t.profile.terms }));
    await user.click(screen.getByRole("button", { name: t.profile.start }));
    expect(await screen.findByText(t.profile.invalid)).toBeInTheDocument();
  });

  it("sends a visitor to sign in and an answered account straight on", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(open("/en/saved")).rejects.toThrow(`REDIRECT /en/login?next=${encodeURIComponent("/en/onboarding?next=%2Fen%2Fsaved")}`);
    session.currentUser.mockResolvedValue(settled);
    await expect(open("/en/saved")).rejects.toThrow("REDIRECT /en/saved");
    await expect(open()).rejects.toThrow("REDIRECT /en");
  });

  it("starts from the name the account already has", async () => {
    session.currentUser.mockResolvedValue({ ...newUser, name: "Nino" });
    render(await open());
    expect(screen.getByRole("textbox", { name: t.profile.name })).toHaveValue("Nino");
  });
});

describe("account guard", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("sends a new account to onboarding from any account page, coming back to it", async () => {
    window.history.replaceState(null, "", "/en/messages?x=1");
    session.currentUser.mockResolvedValue(newUser);
    render(await AccountLayout({ children: <main>inside</main>, params }));
    expect(screen.queryByText("inside")).toBeNull();
    expect(screen.getByRole("link", { name: t.profile.finish })).toHaveAttribute("href", "/en/onboarding");
    expect(router.replace).toHaveBeenCalledWith("/en/onboarding?next=%2Fen%2Fmessages%3Fx%3D1");
  });

  it("shows the page to an answered account and to visitors, whom the page sends to sign in", async () => {
    session.currentUser.mockResolvedValue(settled);
    render(await AccountLayout({ children: <main>inside</main>, params }));
    expect(screen.getByText("inside")).toBeInTheDocument();
    session.currentUser.mockResolvedValue(null);
    render(await AccountLayout({ children: <main>visitor</main>, params }));
    expect(screen.getByText("visitor")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("ProfilePage", () => {
  const profile = { name: "Nino Beridze", avatarUrl: null, intent: "OWNER", createdAt: new Date("2026-03-05T22:00:00Z") };

  it("shows the photo, name, join date and intent, and links to sign-in and security", async () => {
    session.currentUser.mockResolvedValue(settled);
    db.getProfile.mockResolvedValue(profile);
    const { container } = render(await ProfilePage({ params }));
    expect(db.getProfile).toHaveBeenCalledWith("u1");
    expect(container.querySelector(".av")).toHaveTextContent("NB");
    // Tbilisi time: already the 6th there.
    expect(screen.getByText("On MTeam since March 6, 2026")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: t.profile.name })).toHaveValue("Nino Beridze");
    expect(screen.getByRole("radio", { name: t.profile.intents.OWNER })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("link", { name: new RegExp(t.profile.security) })).toHaveAttribute("href", "/en/account/security");
    expect(screen.queryByText("+995")).toBeNull();
  });

  it("saves changes and says so", async () => {
    const user = userEvent.setup();
    session.currentUser.mockResolvedValue(settled);
    db.getProfile.mockResolvedValue(profile);
    render(await ProfilePage({ params }));
    await user.click(screen.getByRole("button", { name: t.profile.save }));
    expect(await screen.findByText(t.profile.saved)).toBeInTheDocument();
    expect(db.updateProfile).toHaveBeenCalledWith("u1", { name: "Nino Beridze", intent: "OWNER" });
  });

  it("says when the answers are refused, starting empty for an account without them", async () => {
    const user = userEvent.setup();
    session.currentUser.mockResolvedValue(settled);
    db.getProfile.mockResolvedValue({ ...profile, name: null, intent: null });
    render(await ProfilePage({ params }));
    expect(screen.getByRole("textbox", { name: t.profile.name })).toHaveValue("");
    await user.type(screen.getByRole("textbox", { name: t.profile.name }), "Nino");
    await user.click(screen.getByRole("button", { name: t.profile.save }));
    expect(await screen.findByText(t.profile.invalid)).toBeInTheDocument();
  });

  it("sends a visitor to sign in", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(ProfilePage({ params })).rejects.toThrow("REDIRECT /en/login?next=%2Fen%2Faccount%2Fprofile");
  });
});

describe("AvatarUpload", () => {
  const fetch = vi.fn();
  const photo = new File(["x"], "me.jpg", { type: "image/jpeg" });
  const show = () => render(<AvatarUpload locale="en" t={t} name="Nino" url="https://cdn.example/a.webp" joined="since" />);

  beforeEach(() => vi.stubGlobal("fetch", fetch));
  afterEach(() => vi.unstubAllGlobals());

  it("uploads the chosen photo and shows the new one", async () => {
    fetch.mockResolvedValue(Response.json({ avatarUrl: "https://cdn.example/b.webp" }));
    const { container } = show();
    expect(container.querySelector("img.av")).toHaveAttribute("src", "https://cdn.example/a.webp");
    await userEvent.upload(screen.getByLabelText(t.profile.photo), photo);
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/en/account/profile/avatar");
    expect(init.body.get("photo")).toBeInstanceOf(File);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["the hourly limit", async () => Response.json({ error: "tooMany" }, { status: 429 }), t.profile.photoTooMany],
    ["a refused photo", async () => Response.json({ error: "photo" }, { status: 422 }), t.profile.photoFailed],
    ["an unknown answer", async () => Response.json({ error: "forbidden" }, { status: 403 }), t.profile.photoFailed],
    ["a proxy's page instead of ours", async () => new Response("Request Entity Too Large", { status: 413 }), t.profile.photoFailed],
    ["no connection", async () => Promise.reject(new TypeError("offline")), t.profile.photoFailed],
  ])("explains %s", async (_, reply, message) => {
    fetch.mockImplementation(reply);
    show();
    await userEvent.upload(screen.getByLabelText(t.profile.photo), photo);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("sends a signed-out user to sign in, coming back here", async () => {
    fetch.mockResolvedValue(Response.json({ error: "signedOut" }, { status: 401 }));
    show();
    await userEvent.upload(screen.getByLabelText(t.profile.photo), photo);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/en/login?next=%2Fen%2Faccount%2Fprofile"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  describe("shrinking in the browser", () => {
    const bitmap = { width: 4000, height: 3000, close: vi.fn() };
    const draw = vi.fn();
    const small = new Blob(["small"], { type: "image/jpeg" });
    const sent = async () => {
      fetch.mockResolvedValue(Response.json({ avatarUrl: "https://cdn.example/b.webp" }));
      show();
      await userEvent.upload(screen.getByLabelText(t.profile.photo), photo);
      await waitFor(() => expect(fetch).toHaveBeenCalled());
      return fetch.mock.calls[0][1].body.get("photo") as File;
    };

    beforeEach(() => {
      vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: draw } as unknown as CanvasRenderingContext2D);
      vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => done(small));
    });
    afterEach(() => vi.restoreAllMocks());

    it("sends a big photo upright, at 1024 px on its long side, as JPEG", async () => {
      const file = await sent();
      expect(createImageBitmap).toHaveBeenCalledWith(photo, { imageOrientation: "from-image" });
      expect(draw).toHaveBeenCalledWith(bitmap, 0, 0, 1024, 768);
      expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.9);
      expect(bitmap.close).toHaveBeenCalled();
      expect(file.size).toBe(small.size);
    });

    it("never enlarges a small photo", async () => {
      vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ ...bitmap, width: 300, height: 400 })));
      await sent();
      expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 300, 400);
    });

    it.each([
      ["has no canvas", () => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)],
      ["cannot encode", () => vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => done(null))],
      ["cannot decode the photo", () => vi.stubGlobal("createImageBitmap", vi.fn(async () => Promise.reject(new Error("bad image"))))],
    ])("sends the original when the browser %s", async (_, breakIt) => {
      breakIt();
      expect((await sent()).size).toBe(photo.size);
    });
  });

  it("does nothing when the choice is cancelled", async () => {
    show();
    const input = screen.getByLabelText<HTMLInputElement>(t.profile.photo);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    Object.defineProperty(input, "files", { value: null });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Avatar", () => {
  it("shows up to two initials, and an empty circle without a name", () => {
    const { container, rerender } = render(<Avatar name="ნინო  ბერიძე გელა" url={null} />);
    expect(container.querySelector(".av")).toHaveTextContent(/^ნბ$/);
    rerender(<Avatar name="nino beridze" url={null} />);
    expect(container.querySelector(".av")).toHaveTextContent(/^NB$/);
    rerender(<Avatar name={null} url={null} />);
    expect(container.querySelector(".av")).toHaveTextContent(/^$/);
  });
});
