import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";
import { fixtureListings } from "@/test-fixtures";

const db = vi.hoisted(() => ({ getListing: vi.fn() }));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), hasSession: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("next/navigation", () => ({
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

const t = getDictionary("en");
const server = vi.fn();
const reply = (status: number, body: unknown = {}) => server.mockResolvedValue({ ok: status < 400, status, json: async () => body });
beforeEach(() => {
  vi.resetAllMocks();
  session.currentUser.mockResolvedValue({ id: "u1" });
  vi.stubGlobal("fetch", server);
});

afterEach(() => vi.unstubAllGlobals());

describe("ListingForm", () => {
  it("keeps what was typed and shows the error when the server rejects it", async () => {
    reply(422, { error: "invalid" });
    render(<ListingForm locale="en" t={t} />);
    const title = screen.getByLabelText(t.post.fields.title);
    fireEvent.change(title, { target: { value: "My flat" } });
    fireEvent.submit(title.closest("form") as HTMLFormElement);

    expect(await screen.findByRole("alert")).toHaveTextContent(t.post.errors.invalid);
    await waitFor(() => expect(title).toHaveValue("My flat"));
    expect(server).toHaveBeenCalledWith("/api/listings", expect.objectContaining({ method: "POST" }));
  });

  describe("sending", () => {
    const send = () => {
      render(<ListingForm locale="ka" t={t} />);
      fireEvent.submit(screen.getByLabelText(t.post.fields.title).closest("form") as HTMLFormElement);
    };

    it("confirms a listing the server accepted", async () => {
      reply(200);
      send();
      await waitFor(() => expect(router.push).toHaveBeenCalledWith("/ka/listings/new?sent=1"));
    });

    it("sends someone whose session ended to sign in", async () => {
      reply(401, { error: "signedOut" });
      send();
      await waitFor(() => expect(router.push).toHaveBeenCalledWith("/ka/login"));
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

    it("shows the photo error from the server", async () => {
      reply(422, { error: "photos" });
      send();
      expect(await screen.findByRole("alert")).toHaveTextContent(t.post.errors.photos);
    });
  });

  it.each([
    ["too many photos", Array.from({ length: 11 }, () => new File(["x"], "a.jpg"))],
    ["an oversized photo", [new File([new Uint8Array(5 * 1024 * 1024 + 1)], "a.jpg")]],
  ])("rejects %s in the browser without sending anything", async (_name, files) => {
    render(<ListingForm locale="en" t={t} />);
    // jsdom leaves assigned files out of FormData, so the submitted photos are supplied directly.
    const getAll = vi.spyOn(FormData.prototype, "getAll").mockReturnValue(files);
    fireEvent.submit(screen.getByLabelText(t.post.fields.photos).closest("form") as HTMLFormElement);

    expect(await screen.findByRole("alert")).toHaveTextContent(t.post.errors.photos);
    expect(server).not.toHaveBeenCalled();
    getAll.mockRestore();
  });

  it("previews chosen photos and releases the previous ones", () => {
    const created = vi.fn().mockReturnValueOnce("blob:one").mockReturnValueOnce("blob:two");
    const revoked = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked }));
    const { container, unmount } = render(<ListingForm locale="en" t={t} />);
    const input = screen.getByLabelText(t.post.fields.photos);

    expect(container.querySelector(".previews")).toBeNull();
    fireEvent.change(input, { target: { files: [new File(["x"], "a.jpg")] } });
    expect(container.querySelector(".previews img")).toHaveAttribute("src", "blob:one");
    fireEvent.change(input, { target: { files: [new File(["y"], "b.jpg")] } });
    expect(revoked).toHaveBeenCalledWith("blob:one");
    expect(container.querySelector(".previews img")).toHaveAttribute("src", "blob:two");
    unmount();
    expect(revoked).toHaveBeenCalledWith("blob:two");
    vi.unstubAllGlobals();
  });

  describe("steps", () => {
    const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    const next = () => fireEvent.click(screen.getByRole("button", { name: t.post.next }));
    const current = () => document.querySelector("[aria-current=step]")?.textContent;
    const completeFirst = () => {
      fill(t.post.fields.district, "ვაკე");
      fill(t.post.fields.address, "Main 1");
      next();
    };
    const completeSecond = () => {
      fill(t.post.fields.price, "1000");
      fill(t.post.fields.area, "50");
      fill(t.post.fields.rooms, "2");
      fill(t.post.fields.title, "Flat");
      fill(t.post.fields.description, "Sunny");
      next();
    };

    it("starts on the first step with no way back and no submit", () => {
      render(<ListingForm locale="en" t={t} />);
      expect(current()).toBe("1 Location");
      expect(screen.queryByRole("button", { name: t.post.back })).toBeNull();
      expect(screen.queryByRole("button", { name: t.post.submit })).toBeNull();
    });

    it("does not advance past a step with a missing required field", () => {
      render(<ListingForm locale="en" t={t} />);
      next();
      expect(current()).toBe("1 Location");
    });

    it("asks only for what fits the property type", () => {
      render(<ListingForm locale="en" t={t} />);
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
      render(<ListingForm locale="en" t={t} />);
      expect(document.querySelector("input[name=metro]")).not.toBeRequired();
      expect(document.querySelector("input[name=building]")).not.toBeRequired();
      expect(screen.getByRole("option", { name: t.search.building.construction, hidden: true })).toBeInTheDocument();
      fill(t.search.city, "ბათუმი");
      expect(screen.queryByLabelText(t.search.metro)).toBeNull();
    });

    it("needs a district in a city that has them", () => {
      render(<ListingForm locale="en" t={t} />);
      fill(t.post.fields.address, "Main 1");
      next();
      expect(current()).toBe("1 Location");
    });

    it("offers the district's streets once one is chosen, and keeps them optional", async () => {
      render(<ListingForm locale="en" t={t} />);
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
      render(<ListingForm locale="en" t={t} />);
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
      render(<ListingForm locale="en" t={t} />);
      completeFirst();
      expect(current()).toBe("2 Details");
      expect(screen.getByRole("group", { name: t.post.steps.details })).toHaveFocus();
      completeSecond();
      expect(current()).toBe("3 Photos");
      expect(screen.getByRole("group", { name: t.post.steps.photos })).toHaveFocus();
      expect(screen.getByRole("button", { name: t.post.submit })).toHaveAttribute("type", "submit");
      expect(screen.queryByRole("button", { name: t.post.next })).toBeNull();
    });

    it("hides the other steps but keeps their values in the form", () => {
      const { container } = render(<ListingForm locale="en" t={t} />);
      completeFirst();
      expect(container.querySelectorAll("fieldset.off")).toHaveLength(2);
      expect(container.querySelector("fieldset:not(.off)")).toHaveAccessibleName(t.post.steps.details);
      expect(screen.getByLabelText(t.post.fields.district)).toHaveValue("ვაკე");
    });

    it("catches a rule across fields before the photos step, then lets it be corrected", () => {
      render(<ListingForm locale="en" t={t} />);
      completeFirst();
      fill(t.post.fields.floor, "9");
      fill(t.post.fields.floors, "5");
      completeSecond();
      expect(current()).toBe("2 Details");
      expect(screen.getByRole("alert")).toHaveTextContent(t.post.errors.invalid);

      fill(t.post.fields.floors, "12");
      next();
      expect(current()).toBe("3 Photos");
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("clears that error when going back", () => {
      render(<ListingForm locale="en" t={t} />);
      completeFirst();
      fill(t.post.fields.floor, "9");
      completeSecond();
      expect(screen.getByRole("alert")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: t.post.back }));
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("goes back without needing the current step to be valid", () => {
      render(<ListingForm locale="en" t={t} />);
      completeFirst();
      fireEvent.click(screen.getByRole("button", { name: t.post.back }));
      expect(current()).toBe("1 Location");
      expect(screen.getByLabelText(t.post.fields.address)).toHaveValue("Main 1");
    });
  });

  it("offers translated choices", () => {
    render(<ListingForm locale="ru" t={getDictionary("ru")} />);
    expect(screen.getByRole("option", { name: "Батуми" })).toBeInTheDocument();
  });
});

describe("NewListingPage", () => {
  const params = Promise.resolve({ locale: "en" });

  it("requires a valid session", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(NewListingPage({ params, searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT /en/login");
  });

  it("shows the form", async () => {
    render(await NewListingPage({ params, searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("button", { name: t.post.next })).toBeInTheDocument();
  });

  it("confirms a submitted listing", async () => {
    render(await NewListingPage({ params, searchParams: Promise.resolve({ sent: "1" }) }));
    expect(screen.getByRole("status")).toHaveTextContent(t.post.sent);
    expect(screen.queryByRole("button", { name: t.post.next })).toBeNull();
  });
});

describe("listing photos", () => {
  const withPhotos = { ...fixtureListings[0], images: ["https://cdn/a.jpg", "https://cdn/b.jpg"] };

  it("shows the first photo on a card", () => {
    render(<ListingCard listing={withPhotos} locale="en" t={t} />);
    expect(screen.getAllByRole("img", { name: withPhotos.title })[0]).toHaveAttribute("src", "https://cdn/a.jpg");
  });

  it("omits the room count on a card for property without rooms", () => {
    render(<ListingCard listing={{ ...fixtureListings[0], rooms: 0 }} locale="en" t={t} />);
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

  it("omits the rooms fact for property without rooms", async () => {
    db.getListing.mockResolvedValue({ ...fixtureListings[0], rooms: 0 });
    render(await ListingPage({ params: Promise.resolve({ locale: "en", id: "20418" }), searchParams: Promise.resolve({}) }));
    expect(screen.queryByText(t.listing.rooms)).toBeNull();
  });
});
