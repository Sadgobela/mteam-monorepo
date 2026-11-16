import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";
import { fixtureListings } from "@/test-fixtures";

const db = vi.hoisted(() => ({ getGelPerUsd: async () => 2.7,
  getListing: vi.fn(),
  countSellerListings: vi.fn(async () => 0),
  getFavoriteIds: vi.fn(async () => []),
  getHiddenIds: vi.fn(async () => []),
  listSimilarListings: vi.fn(async () => []),
  hidesPhoneByDefault: vi.fn(),
  getEditableListing: vi.fn(),
}));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), hasSession: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@mteam/db", () => db);
// The browser redraw is tested on its own; here a chosen file goes up as it is.
vi.mock("@/lib/shrink-photo", () => ({ shrinkPhoto: async (file: File) => file }));
// The price hint has its own test; here the market has no figures.
vi.mock("@/lib/post-actions", () => ({ marketStatsAction: async () => [] }));
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn(), addPhoneAction: vi.fn(), loginAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => null,
  useSearchParams: () => null,
  useRouter: () => router,
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

// Ant's Select lists options lazily in a portal. A native one lets these tests read every choice; FormSelect has its own test with the real thing.
vi.mock("antd", async (importOriginal) => ({
  ...(await importOriginal<typeof import("antd")>()),
  Select: ({ id, value, options, onChange }: { id: string; value?: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) => (
    <select id={id} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
      <option value="" />
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("leaflet", () => ({
  default: {
    map: () => {
      const map = { setView: () => map, fitBounds: () => map, remove: () => undefined, on: () => undefined };
      return map;
    },
    tileLayer: () => ({ addTo: () => undefined }),
    circleMarker: () => ({ bindPopup: () => ({ addTo: () => undefined }), addTo: () => undefined }),
    latLngBounds: (points: unknown) => points,
  },
}));

import { ListingCard } from "@/components/ListingCard";
import { ListingForm } from "@/components/ListingForm";
import ListingPage from "./[locale]/listings/[id]/page";
import NewListingPage from "./[locale]/listings/new/page";
import EditListingPage from "./[locale]/listings/[id]/edit/page";

const t = getDictionary("en");
const server = vi.fn();
const answer = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
/** The listing endpoint answers with `status` and `body`; each photo upload succeeds with the next address. */
const reply = (status: number, body: unknown = { id: 7, status: "PENDING" }) => {
  let uploads = 0;
  server.mockImplementation(async (path: string) => (path === "/api/listings/photos" ? answer(200, { url: `https://cdn/u${++uploads}.webp` }) : answer(status, body)));
};
const sentTo = (path: string) => server.mock.calls.filter(([to]) => to === path).map(([, init]) => init.body as FormData);
let previews = 0;
beforeEach(() => {
  vi.resetAllMocks();
  previews = 0;
  session.currentUser.mockResolvedValue({ id: "u1", phone: "+995555123456" });
  vi.stubGlobal("fetch", server);
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => `blob:${++previews}`, revokeObjectURL: vi.fn() }));
});

afterEach(() => vi.unstubAllGlobals());

const choose = (...names: string[]) =>
  fireEvent.change(screen.getByLabelText(t.post.fields.photos), { target: { files: names.map((name) => new File(["x"], name, { type: "image/jpeg" })) } });
const formOf = (label: string) => screen.getByLabelText(label).closest("form") as HTMLFormElement;

describe("ListingForm", () => {
  it("keeps what was typed and shows the error when the server rejects it", async () => {
    reply(422, { error: "invalid" });
    render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
    choose("a.jpg");
    const title = screen.getByLabelText(t.post.fields.title);
    fireEvent.change(title, { target: { value: "My flat" } });
    fireEvent.submit(formOf(t.post.fields.title));

    expect(await screen.findByRole("alert")).toHaveTextContent(t.post.errors.invalid);
    await waitFor(() => expect(title).toHaveValue("My flat"));
  });

  it("asks for a photo before sending anything", async () => {
    render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
    fireEvent.submit(formOf(t.post.fields.title));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.post.errors.photos);
    expect(server).not.toHaveBeenCalled();
  });

  describe("sending", () => {
    const send = (...photos: string[]) => {
      render(<ListingForm gelPerUsd={2.7} locale="ka" t={t} />);
      choose(...(photos.length ? photos : ["a.jpg"]));
      fireEvent.submit(formOf(t.post.fields.title));
    };

    it("uploads each photo on its own, then sends the listing with their addresses in order, and confirms it", async () => {
      reply(200);
      send("a.jpg", "b.jpg");
      await waitFor(() => expect(router.push).toHaveBeenCalledWith("/ka/listings/new?sent=1"));
      expect(sentTo("/api/listings/photos").map((body) => (body.get("photo") as File).name)).toEqual(["a.jpg", "b.jpg"]);
      const [listing] = sentTo("/api/listings");
      expect(listing.getAll("photos")).toEqual(["https://cdn/u1.webp", "https://cdn/u2.webp"]);
      expect([listing.get("intent"), listing.get("id"), listing.get("hidePhone")]).toEqual(["submit", null, null]);
    });

    it("sends someone whose session ended to sign in", async () => {
      reply(401, { error: "signedOut" });
      send();
      await waitFor(() => expect(router.push).toHaveBeenCalledWith("/ka/login?next=%2Fka%2Flistings%2Fnew"));
    });

    it("says so when the connection fails, and allows another try", async () => {
      server.mockRejectedValue(new Error("offline"));
      send();
      expect(await screen.findByRole("alert")).toHaveTextContent(t.post.errors.save);
      expect(router.push).not.toHaveBeenCalled();
    });

    it("treats a reply it does not understand as a failed save", async () => {
      reply(500, { surprise: true });
      send();
      expect(await screen.findByRole("alert")).toHaveTextContent(t.post.errors.save);
    });

    it.each([["photos"], ["tooMany"], ["missing"]] as const)("shows the %s error from the server", async (error) => {
      reply(422, { error });
      send();
      expect(await screen.findByRole("alert")).toHaveTextContent(t.post.errors[error]);
    });

    it("does not upload a photo twice when trying again after a failed upload", async () => {
      let uploads = 0;
      server.mockImplementation(async (path: string) =>
        path === "/api/listings/photos" ? (++uploads === 2 ? answer(413, { error: "photos" }) : answer(200, { url: `https://cdn/u${uploads}.webp` })) : answer(200, { id: 7, status: "PENDING" }),
      );
      send("a.jpg", "b.jpg");
      expect(await screen.findByRole("alert")).toHaveTextContent(t.post.errors.photos);
      fireEvent.submit(formOf(t.post.fields.title));
      await waitFor(() => expect(router.push).toHaveBeenCalled());
      expect(sentTo("/api/listings/photos").map((body) => (body.get("photo") as File).name)).toEqual(["a.jpg", "b.jpg", "b.jpg"]);
      expect(sentTo("/api/listings")[0].getAll("photos")).toEqual(["https://cdn/u1.webp", "https://cdn/u3.webp"]);
    });
  });

  describe("photos", () => {
    const shown = () => Array.from(document.querySelectorAll(".photo-list img")).map((image) => image.getAttribute("src"));

    it("adds chosen photos after the ones there, marks the first as the main one, and reorders and removes them", () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      choose("a.jpg", "b.jpg");
      choose("c.jpg");
      expect(shown()).toEqual(["blob:1", "blob:2", "blob:3"]);
      expect(screen.getAllByText(t.post.fields.cover)).toHaveLength(1);
      expect(screen.getByRole("button", { name: `${t.post.fields.photoEarlier} 1` })).toBeDisabled();
      expect(screen.getByRole("button", { name: `${t.post.fields.photoLater} 3` })).toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: `${t.post.fields.photoEarlier} 3` }));
      expect(shown()).toEqual(["blob:1", "blob:3", "blob:2"]);
      fireEvent.click(screen.getByRole("button", { name: `${t.post.fields.photoLater} 1` }));
      expect(shown()).toEqual(["blob:3", "blob:1", "blob:2"]);
      fireEvent.click(screen.getByRole("button", { name: `${t.post.fields.photoRemove} 2` }));
      expect(shown()).toEqual(["blob:3", "blob:2"]);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:1");
    });

    it("keeps at most sixteen and says so", () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      choose(...Array.from({ length: 15 }, (_, index) => `${index}.jpg`));
      choose("x.jpg", "y.jpg");
      expect(shown()).toHaveLength(16);
      expect(screen.getByRole("alert")).toHaveTextContent(t.post.errors.photos);
      choose("z.jpg");
      expect(shown()).toHaveLength(16);
    });

    it("releases the previews of chosen photos when the form goes away", () => {
      const { unmount } = render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      choose("a.jpg");
      unmount();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:1");
    });
  });

  describe("steps", () => {
    // The selector skips the step of the same name ("Price"), which is labelled too.
    const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { selector: "input, select, textarea" }), { target: { value } });
    const next = () => fireEvent.click(screen.getByRole("button", { name: t.post.next }));
    const current = () => document.querySelector("[aria-current=step]")?.textContent;
    const completeFirst = () => {
      fill(t.post.fields.district, "ვაკე");
      fill(t.post.fields.address, "Main 1");
      next();
    };
    const completeSecond = () => {
      fill(t.post.fields.area, "50");
      fill(t.post.fields.rooms, "2");
      fill(t.post.fields.title, "Flat");
      fill(t.post.fields.description, "Sunny");
      next();
    };
    const completePrice = () => {
      fill(t.post.fields.price, "1000");
      next();
    };
    const toLast = () => {
      completeFirst();
      completeSecond();
      completePrice();
      next();
    };

    it("starts on the first step with no way back and no submit", () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      expect(current()).toBe("1 Location");
      expect(screen.queryByRole("button", { name: t.post.back })).toBeNull();
      expect(screen.queryByRole("button", { name: t.post.submit })).toBeNull();
    });

    it("does not advance past a step with a missing required field", () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      next();
      expect(current()).toBe("1 Location");
    });

    it("asks only for what fits the property type", () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      const shown = (label: string) => screen.queryByLabelText(label) !== null;
      expect(screen.getByLabelText(t.post.fields.rooms)).toBeRequired();
      fill(t.search.type, "land");
      expect([shown(t.post.fields.rooms), shown(t.post.fields.floor), shown(t.post.fields.floors), shown(t.search.status)]).toEqual([false, false, false, false]);
      fill(t.search.type, "commercial");
      expect([shown(t.post.fields.rooms), shown(t.post.fields.floor), shown(t.search.status)]).toEqual([false, true, true]);
      fill(t.search.type, "hotel");
      expect(screen.getByLabelText(t.post.fields.rooms)).not.toBeRequired();
    });

    it("offers metro stations only in Tbilisi, and building status always", () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      expect(document.querySelector("input[name=metro]")).not.toBeRequired();
      expect(document.querySelector("input[name=building]")).not.toBeRequired();
      expect(screen.getByRole("option", { name: t.search.building.construction, hidden: true })).toBeInTheDocument();
      fill(t.search.city, "ბათუმი");
      expect(screen.queryByLabelText(t.search.metro)).toBeNull();
    });

    it("needs a district in a city that has them", () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      fill(t.post.fields.address, "Main 1");
      next();
      expect(current()).toBe("1 Location");
    });

    it("offers the district's streets once one is chosen, and keeps them optional", async () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      expect(screen.queryByLabelText(t.post.fields.street)).toBeNull();
      fill(t.post.fields.district, "ვაკე");
      fireEvent.change(await screen.findByLabelText(t.post.fields.street), { target: { value: "ჭავჭავაძე ი. გამზირი" } });
      expect(screen.getByLabelText(t.post.fields.street)).toHaveValue("ჭავჭავაძე ი. გამზირი");
      expect(document.querySelector("input[name=street]")).not.toBeRequired();
      fill(t.search.city, "რუსთავი");
      expect((await screen.findByLabelText(t.post.fields.street)).querySelectorAll("option").length).toBe(116);
      fill(t.search.city, "ბათუმი");
      expect(screen.queryByLabelText(t.post.fields.street)).toBeNull();
    });

    it("offers the chosen city's districts, and none where it has none", () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      expect(screen.getByRole("option", { name: "Vake" })).toBeInTheDocument();
      fill(t.search.city, "ბათუმი");
      expect(screen.queryByRole("option", { name: "Vake" })).toBeNull();
      expect(screen.getByRole("option", { name: "Makhinjauri" })).toBeInTheDocument();
      fill(t.search.city, "რუსთავი");
      expect(screen.queryByLabelText(t.post.fields.district)).toBeNull();
      fill(t.post.fields.address, "Main 1");
      next();
      expect(current()).toBe("2 Details");
    });

    it("advances, moves focus to the new step, and only then offers submit", () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      completeFirst();
      expect(current()).toBe("2 Details");
      expect(screen.getByRole("group", { name: t.post.steps.details })).toHaveFocus();
      completeSecond();
      expect(current()).toBe("3 Price");
      completePrice();
      expect(current()).toBe("4 Photos");
      expect(screen.getByRole("group", { name: t.post.steps.photos })).toHaveFocus();
      next();
      expect(current()).toBe("5 Contact");
      expect(screen.getByRole("button", { name: t.post.submit })).toHaveAttribute("type", "submit");
      expect(screen.queryByRole("button", { name: t.post.next })).toBeNull();
    });

    it("lets someone whose session ended post again after closing sign-in", async () => {
      reply(401, { error: "signedOut" });
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      choose("a.jpg");
      toLast();
      const button = screen.getByRole("button", { name: t.post.submit });
      fireEvent.submit(button.closest("form") as HTMLFormElement);
      await waitFor(() => expect(router.push).toHaveBeenCalledWith("/en/login?next=%2Fen%2Flistings%2Fnew"));
      expect(button).toBeEnabled();
    });

    it("hides the other steps but keeps their values in the form", () => {
      const { container } = render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      completeFirst();
      expect(container.querySelectorAll("fieldset.off")).toHaveLength(4);
      expect(container.querySelector("fieldset:not(.off)")).toHaveAccessibleName(t.post.steps.details);
      expect(screen.getByLabelText(t.post.fields.district)).toHaveValue("ვაკე");
    });

    it("catches a rule across fields before the photos step, then lets it be corrected", () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      completeFirst();
      fill(t.post.fields.floor, "9");
      fill(t.post.fields.floors, "5");
      completeSecond();
      expect(current()).toBe("2 Details");
      expect(screen.getByRole("alert")).toHaveTextContent(t.post.errors.invalid);

      fill(t.post.fields.floors, "12");
      next();
      expect(current()).toBe("3 Price");
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("catches a price per m² beyond any real one before the photos step", () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      completeFirst();
      completeSecond();
      fill(t.post.fields.area, "1");
      fill(t.post.fields.price, "2000000000");
      next();
      expect(current()).toBe("3 Price");
      expect(screen.getByRole("alert")).toHaveTextContent(t.post.errors.invalid);
    });

    it("clears that error when going back", () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      completeFirst();
      fill(t.post.fields.floor, "9");
      completeSecond();
      expect(screen.getByRole("alert")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: t.post.back }));
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("goes back without needing the current step to be valid", () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      completeFirst();
      fireEvent.click(screen.getByRole("button", { name: t.post.back }));
      expect(current()).toBe("1 Location");
      expect(screen.getByLabelText(t.post.fields.address)).toHaveValue("Main 1");
    });
  });

  describe("preview and quality", () => {
    const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { selector: "input, textarea" }), { target: { value } });
    const preview = () => screen.getByRole("region", { name: t.post.preview });

    it("shows the listing as a card while it is typed, with the first photo", async () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      expect(preview()).toHaveTextContent("Tbilisi");
      fireEvent.change(screen.getByLabelText(t.search.deal), { target: { value: "rent" } });
      fireEvent.change(screen.getByLabelText(t.post.fields.district), { target: { value: "ვაკე" } });
      type(t.post.fields.title, "Sunny flat");
      type(t.post.fields.price, "900");
      type(t.post.fields.area, "50");
      type(t.post.fields.rooms, "2");
      fireEvent.change(screen.getByLabelText(t.post.fields.currency), { target: { value: "GEL" } });
      choose("a.jpg");
      await waitFor(() => expect(preview()).toHaveTextContent(`₾900 ${t.perMonth}`));
      expect(preview()).toHaveTextContent("Sunny flat");
      expect(preview()).toHaveTextContent("Vake, Tbilisi");
      expect(preview()).toHaveTextContent(`50 ${t.units.sqm}`);
      expect(preview()).toHaveTextContent(`2 ${t.units.rooms}`);
      expect(preview().querySelector("img")).toHaveAttribute("src", "blob:1");
    });

    it("shows a dash for what is not filled in yet", () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      expect(preview()).toHaveTextContent(`${t.post.preview}——`);
    });

    it("scores the listing and says what to add next", async () => {
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      const meter = () => screen.getByRole("meter", { name: t.post.quality.heading });
      expect(meter()).toHaveAttribute("value", "0");
      expect(screen.getByText(t.post.quality.tips.photos.replace("{count}", "8"))).toBeInTheDocument();
      type(t.post.fields.cadastralCode, "01.10");
      fireEvent.change(screen.getByLabelText(t.search.status), { target: { value: "new" } });
      await waitFor(() => expect(meter()).toHaveAttribute("value", String(10 + 4)));
      expect(screen.queryByText(t.post.quality.tips.cadastralCode)).toBeNull();
    });

    it("says when nothing is missing", async () => {
      const full = { ...editable, images: Array.from({ length: 8 }, (_, index) => `https://cdn/${index}.webp`), fields: { ...editable.fields, description: "a".repeat(300), bedrooms: "1", ceiling: "3", yearBuilt: "2020" } };
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} initial={full} />);
      expect(await screen.findByText(t.post.quality.done)).toBeInTheDocument();
    });
  });

  describe("autosave", () => {
    const next = () => fireEvent.click(screen.getByRole("button", { name: t.post.next }));
    const start = () => {
      fireEvent.change(screen.getByLabelText(t.post.fields.district), { target: { value: "ვაკე" } });
      fireEvent.change(screen.getByLabelText(t.post.fields.address, { selector: "input" }), { target: { value: "Main 1" } });
    };

    it("saves a new listing as a draft at each step, into the same draft, and sends that draft for review", async () => {
      reply(200, { id: 12, status: "DRAFT" });
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      start();
      choose("a.jpg");
      next();
      await waitFor(() => expect(sentTo("/api/listings")).toHaveLength(1));
      const [first] = sentTo("/api/listings");
      expect([first.get("intent"), first.get("id"), first.get("district"), first.getAll("photos")]).toEqual(["draft", null, "ვაკე", ["https://cdn/u1.webp"]]);

      fireEvent.click(screen.getByRole("button", { name: t.post.back }));
      await waitFor(() => expect(sentTo("/api/listings")).toHaveLength(2));
      expect(sentTo("/api/listings")[1].get("id")).toBe("12");
      expect(sentTo("/api/listings/photos")).toHaveLength(1);

      fireEvent.submit(formOf(t.post.fields.title));
      await waitFor(() => expect(router.push).toHaveBeenCalledWith("/en/listings/new?sent=1"));
      expect([sentTo("/api/listings")[2].get("intent"), sentTo("/api/listings")[2].get("id")]).toEqual(["submit", "12"]);
    });

    it("carries on quietly when a draft cannot be saved", async () => {
      server.mockRejectedValue(new Error("offline"));
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      start();
      next();
      await waitFor(() => expect(server).toHaveBeenCalled());
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("saves nothing while a field holds something it cannot store", async () => {
      reply(200, { id: 12, status: "DRAFT" });
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} />);
      start();
      fireEvent.click(screen.getByRole("button", { name: t.post.next }));
      fireEvent.change(screen.getByLabelText(t.post.fields.area, { selector: "input" }), { target: { value: "-5" } });
      fireEvent.click(screen.getByRole("button", { name: t.post.back }));
      await waitFor(() => expect(sentTo("/api/listings")).toHaveLength(1));
    });

    it("never autosaves a published listing, which would send it for review", async () => {
      reply(200, { id: 9, status: "ACTIVE" });
      render(<ListingForm gelPerUsd={2.7} locale="en" t={t} initial={editable} />);
      next();
      fireEvent.click(screen.getByRole("button", { name: t.post.back }));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(server).not.toHaveBeenCalled();
    });
  });

  it("offers translated choices", () => {
    render(<ListingForm gelPerUsd={2.7} locale="ru" t={getDictionary("ru")} />);
    expect(screen.getByRole("option", { name: "Батуми" })).toBeInTheDocument();
  });
});

describe("NewListingPage", () => {
  const params = Promise.resolve({ locale: "en" });

  it("requires a valid session", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(NewListingPage({ params, searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT /en/login?next=%2Fen%2Flistings%2Fnew");
  });

  it("shows the form, with the number hidden when the user hides it by default", async () => {
    db.hidesPhoneByDefault.mockResolvedValue(true);
    render(await NewListingPage({ params, searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("button", { name: t.post.next })).toBeInTheDocument();
    expect(db.hidesPhoneByDefault).toHaveBeenCalledWith("u1");
    expect(screen.getByRole("checkbox", { name: t.post.fields.hidePhone, hidden: true })).toBeChecked();
  });

  it("asks someone without a phone to add one first", async () => {
    session.currentUser.mockResolvedValue({ id: "u1", phone: null });
    render(await NewListingPage({ params, searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t.post.phoneHeading);
    expect(screen.getByLabelText(t.login.phone)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.post.next })).toBeNull();
  });

  it("confirms a submitted listing", async () => {
    render(await NewListingPage({ params, searchParams: Promise.resolve({ sent: "1" }) }));
    expect(screen.getByRole("status")).toHaveTextContent(t.post.sent);
    expect(screen.queryByRole("button", { name: t.post.next })).toBeNull();
  });
});

const editable = {
  id: 9,
  status: "ACTIVE" as const,
  images: ["https://cdn/listings/old.webp"],
  fields: {
    deal: "rent",
    type: "apartment",
    city: "თბილისი",
    district: "ვაკე",
    street: "ჭავჭავაძე ი. გამზირი",
    metro: "",
    address: "Main 1",
    building: "new",
    price: "900",
    currency: "USD",
    area: "50",
    rooms: "2",
    floor: "3",
    floors: "9",
    title: "Flat",
    description: "Sunny",
    descriptionEn: "Sunny flat",
    descriptionRu: "",
    cadastralCode: "01.10",
    hidePhone: "on",
    lat: "41.7",
    lng: "44.8",
    features: "lift",
  },
};

describe("editing a listing", () => {
  it("fills the form in, keeps the photos it had, and sends the listing's id", async () => {
    reply(200, { id: 9, status: "ACTIVE" });
    render(<ListingForm gelPerUsd={2.7} locale="en" t={t} initial={editable} />);
    expect(screen.getByLabelText(t.post.fields.title)).toHaveValue("Flat");
    expect(screen.getByLabelText(t.post.fields.cadastralCode)).toHaveValue("01.10");
    expect(screen.getByLabelText(t.post.fields.descriptionEn)).toHaveValue("Sunny flat");
    expect(screen.getByLabelText(t.search.deal)).toHaveValue("rent");
    expect(await screen.findByLabelText(t.post.fields.street)).toHaveValue("ჭავჭავაძე ი. გამზირი");
    expect(screen.getByRole("checkbox", { name: t.post.fields.hidePhone, hidden: true })).toBeChecked();
    expect(document.querySelector(".photo-list img")).toHaveAttribute("src", "https://cdn/listings/old.webp");

    for (let step = 0; step < 4; step++) fireEvent.click(screen.getByRole("button", { name: t.post.next }));
    fireEvent.click(screen.getByRole("button", { name: t.post.save }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/en/listings/9/edit?saved=1"));
    expect(sentTo("/api/listings/photos")).toHaveLength(0);
    const [listing] = sentTo("/api/listings");
    expect([listing.get("id"), listing.get("hidePhone"), listing.getAll("photos")]).toEqual(["9", "on", ["https://cdn/listings/old.webp"]]);
  });

  it("forgets the saved street once another district is chosen", async () => {
    render(<ListingForm gelPerUsd={2.7} locale="en" t={t} initial={editable} />);
    await screen.findByLabelText(t.post.fields.street);
    fireEvent.change(screen.getByLabelText(t.post.fields.district), { target: { value: "საბურთალო" } });
    expect(screen.getByLabelText(t.post.fields.street)).toHaveValue("");
  });

  it("sends a reopened draft for review like a new listing", async () => {
    reply(200, { id: 9, status: "PENDING" });
    render(<ListingForm gelPerUsd={2.7} locale="en" t={t} initial={{ ...editable, status: "DRAFT", fields: { deal: "sale", type: "apartment", city: "თბილისი" } }} />);
    expect(screen.queryByRole("checkbox", { name: t.post.fields.hidePhone, hidden: true })).not.toBeChecked();
    fireEvent.submit(formOf(t.post.fields.title));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/en/listings/new?sent=1"));
  });

  it("sends someone whose session ended back to this edit after signing in", async () => {
    reply(401, { error: "signedOut" });
    render(<ListingForm gelPerUsd={2.7} locale="en" t={t} initial={editable} />);
    fireEvent.submit(formOf(t.post.fields.title));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/en/login?next=%2Fen%2Flistings%2F9%2Fedit"));
  });
});

describe("EditListingPage", () => {
  const open = (saved?: string) => EditListingPage({ params: Promise.resolve({ locale: "en", id: "9" }), searchParams: Promise.resolve({ saved }) });

  it("requires a valid session", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(open()).rejects.toThrow("REDIRECT /en/login?next=%2Fen%2Flistings%2F9%2Fedit");
  });

  it("finds nothing for a listing that is not the user's to edit", async () => {
    db.getEditableListing.mockResolvedValue(null);
    await expect(open()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(db.getEditableListing).toHaveBeenCalledWith("u1", "9");
  });

  it("shows the owner's listing in the form", async () => {
    db.getEditableListing.mockResolvedValue(editable);
    render(await open());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t.post.editHeading);
    expect(screen.getByLabelText(t.post.fields.title)).toHaveValue("Flat");
  });

  it("opens a draft under the posting heading", async () => {
    db.getEditableListing.mockResolvedValue({ ...editable, status: "DRAFT" });
    render(await open());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t.post.heading);
  });

  it.each([
    ["ACTIVE", t.post.savedLive],
    ["PENDING", t.post.savedReview],
  ] as const)("after saving, says what became of a listing now %s", async (status, note) => {
    db.getEditableListing.mockResolvedValue({ ...editable, status });
    render(await open("1"));
    expect(screen.getByRole("status")).toHaveTextContent(note);
    expect(screen.getByRole("link", { name: t.post.toMyListings })).toHaveAttribute("href", "/en/my-listings");
  });
});

describe("listing photos", () => {
  const withPhotos = { ...fixtureListings[0], images: ["https://cdn/a.jpg", "https://cdn/b.jpg"] };

  it("shows the first photo on a card", () => {
    render(<ListingCard gelPerUsd={2.7} listing={withPhotos} locale="en" t={t} />);
    expect(screen.getAllByRole("img", { name: withPhotos.title })[0]).toHaveAttribute("src", "https://cdn/a.jpg");
  });

  it("omits the room count on a card for property without rooms", () => {
    render(<ListingCard gelPerUsd={2.7} listing={{ ...fixtureListings[0], rooms: 0 }} locale="en" t={t} />);
    expect(screen.queryByText(/rooms/)).toBeNull();
  });

  it("shows every photo on the listing page", async () => {
    db.getListing.mockResolvedValue(withPhotos);
    render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "20418" }), searchParams: Promise.resolve({}) }));
    expect(screen.getAllByRole("img", { name: new RegExp(withPhotos.title) }).map((i) => i.getAttribute("src"))).toEqual([
      "https://cdn/a.jpg",
      "https://cdn/b.jpg",
    ]);
  });

  it("says who checked a verified listing and when", async () => {
    db.getListing.mockResolvedValue({ ...fixtureListings[0], verification: { by: "Nino", at: "2026-11-05" } });
    render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "20418" }), searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Checked by Nino, Nov 5")).toBeInTheDocument();
  });

  it("shows a map only when the listing has a location", async () => {
    db.getListing.mockResolvedValue({ ...fixtureListings[0], lat: 41.7, lng: 44.7 });
    const pinned = render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "20418" }), searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("region", { name: t.results.map })).toBeInTheDocument();
    pinned.unmount();
    db.getListing.mockResolvedValue({ ...fixtureListings[0], lat: 41.7 });
    render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "20418" }), searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole("region", { name: t.results.map })).toBeNull();
  });

  it("offers the number only when the owner has not hidden it", async () => {
    db.getListing.mockResolvedValue({ ...fixtureListings[0], hidePhone: true });
    const hidden = render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "20418" }), searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole("button", { name: new RegExp(t.listing.showPhone) })).toBeNull();
    expect(hidden.container.textContent).not.toContain("+995 555");
    hidden.unmount();
    db.getListing.mockResolvedValue(fixtureListings[0]);
    render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "20418" }), searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("button", { name: new RegExp(t.listing.showPhone) })).toBeInTheDocument();
  });

  it("omits the rooms fact for property without rooms", async () => {
    db.getListing.mockResolvedValue({ ...fixtureListings[0], rooms: 0 });
    render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "20418" }), searchParams: Promise.resolve({}) }));
    expect(screen.queryByText(t.listing.rooms)).toBeNull();
  });
});
