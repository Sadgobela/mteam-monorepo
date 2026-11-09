import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getDictionary, type Listing } from "@mteam/shared";
import { fixtureListings } from "@/test-fixtures";
import { Select } from "antd";
import { AntProvider } from "./AntProvider";
import { FilterChips } from "./FilterChips";
import { Header } from "./Header";
import { ListingCard } from "./ListingCard";
import { SearchBar } from "./SearchBar";
import { Segmented } from "./Segmented";

vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
beforeEach(() => push.mockClear());

const t = getDictionary("en");

describe("Header", () => {
  it("shows navigation and marks the current language", () => {
    render(<Header locale="en" t={t} signedIn={false} />);
    expect(screen.getByRole("link", { name: "For sale" })).toHaveAttribute("href", "/en?deal=sale");
    expect(screen.getByRole("link", { name: "MTeam Verified" })).toHaveAttribute("href", "/en?verified=1");
    expect(screen.getByRole("link", { name: "EN" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "KA" })).not.toHaveAttribute("aria-current");
  });

  it("links the drawn logo home, with a name screen readers can announce", () => {
    render(<Header locale="en" t={t} signedIn={false} />);
    const home = screen.getByRole("link", { name: "MTeam" });
    expect(home).toHaveAttribute("href", "/en");
    expect(home.querySelectorAll("svg path")).toHaveLength(2);
  });

  describe("phone menu", () => {
    const menu = () => screen.getByRole("button", { name: "Menu" });
    const panel = () => document.querySelector(".menu-panel") as HTMLElement;
    const expectClosed = () => expect(menu()).toHaveAttribute("aria-expanded", "false");

    it("starts closed and opens with the same navigation", () => {
      render(<Header locale="en" t={t} signedIn={false} />);
      expectClosed();
      expect(panel()).toBeNull();
      fireEvent.click(menu());
      expect(menu()).toHaveAttribute("aria-expanded", "true");
      expect(within(panel()).getByRole("link", { name: "For rent" })).toHaveAttribute("href", "/en?deal=rent");
      expect(within(panel()).getByRole("link", { name: "Sign in" })).toBeInTheDocument();
      expect(within(panel()).getByRole("link", { name: "RU" })).toBeInTheDocument();
    });

    it("closes when a link is followed, because a same-page link would otherwise leave it open", () => {
      render(<Header locale="en" t={t} signedIn={false} />);
      fireEvent.click(menu());
      fireEvent.click(within(panel()).getByRole("link", { name: "For rent" }));
      expectClosed();
    });

    it("stays open while the theme is changed", () => {
      render(<Header locale="en" t={t} signedIn={false} />);
      fireEvent.click(menu());
      fireEvent.click(within(panel()).getByRole("button", { name: /mode/ }));
      expect(menu()).toHaveAttribute("aria-expanded", "true");
    });

    it("closes on submit rather than on the click, so sign out still reaches the server", () => {
      render(<Header locale="en" t={t} signedIn />);
      fireEvent.click(menu());
      const signOut = within(panel()).getByRole("button", { name: "Sign out" });
      // Cancelled so only the click is seen here; removing the form on the click is what used to lose the submit.
      panel().addEventListener("click", (event) => event.preventDefault());
      fireEvent.click(signOut);
      expect(menu()).toHaveAttribute("aria-expanded", "true");
      fireEvent.submit(signOut.closest("form") as HTMLFormElement);
      expectClosed();
    });

    it("closes with its own close button and offers the signed-in links", () => {
      render(<Header locale="en" t={t} signedIn />);
      fireEvent.click(menu());
      expect(within(panel()).getByRole("link", { name: "My listings" })).toBeInTheDocument();
      expect(within(panel()).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
      fireEvent.click(document.querySelector(".ant-drawer-close") as HTMLElement);
      expectClosed();
    });

    it("closes with a second press", () => {
      render(<Header locale="en" t={t} signedIn />);
      fireEvent.click(menu());
      fireEvent.click(menu());
      expectClosed();
    });
  });
});

describe("AntProvider", () => {
  it("names the clear button in the page language", () => {
    const { container } = render(
      <AntProvider locale="ka">
        <Select allowClear value="a" options={[{ value: "a", label: "A" }]} />
      </AntProvider>,
    );
    expect(container.querySelector(`[aria-label="${getDictionary("ka").search.clear}"]`)).not.toBeNull();
  });
});

describe("Segmented", () => {
  const options = [
    { text: "One", href: "/one", active: true },
    { text: "Two", href: "/two", active: false },
  ];

  it("goes to the chosen URL without scrolling", async () => {
    render(<Segmented label="Choice" options={options} />);
    expect(screen.getByRole("radiogroup", { name: "Choice" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "One" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Two" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/two", { scroll: false }));
  });

  it("highlights the first choice when none is active", () => {
    render(<Segmented label="Choice" options={[{ ...options[0], active: false }, options[1]]} />);
    expect(screen.getByRole("radio", { name: "One" })).toBeChecked();
  });
});

describe("FilterChips", () => {
  const all = {
    deal: "rent",
    type: "land",
    city: "ბათუმი",
    q: "marina",
    verified: true,
    rooms: 2,
    priceMin: 100,
    priceMax: 200,
    areaMin: 40,
    areaMax: 90,
    floorMin: 3,
    floorMax: 9,
  } as const;

  it("renders nothing with no filters", () => {
    const { container } = render(<FilterChips locale="en" t={t} query={{}} filters={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows each active filter as a link that removes only it", () => {
    render(<FilterChips locale="en" t={t} query={{ deal: "rent", city: "ბათუმი", page: "3" }} filters={all} />);
    expect(screen.getAllByRole("link")).toHaveLength(12);
    expect(screen.getByRole("link", { name: "Remove filter: Floor from 3" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Remove filter: Batumi" })).toHaveAttribute("href", "/en?deal=rent&city=&page=1");
    expect(screen.getByRole("link", { name: "Remove filter: Area from, m² 40" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Remove filter: marina" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Remove filter: MTeam Verified" })).toBeInTheDocument();
  });
});

describe("SearchBar", () => {
  const display = { sort: "new", view: "grid", cur: "usd", page: 1 } as const;
  const bar = (filters = {}, shown: typeof display | { sort: "asc"; view: "list"; cur: "gel"; page: 1 } = display) =>
    render(<SearchBar locale="en" t={t} filters={filters} display={shown} />);
  const box = (name: string) => screen.getByRole("combobox", { name });
  const keyword = () => screen.getByRole("textbox", { name: "Street or keyword" });
  const submit = () => fireEvent.submit(screen.getByRole("search"));
  const openMore = () => fireEvent.click(screen.getByRole("button", { name: /More filters/ }));
  const pick = (name: string, option: string) => {
    fireEvent.mouseDown(box(name));
    fireEvent.click(document.querySelector(`.ant-select-item-option[title="${option}"]`) as HTMLElement);
  };
  const pushed = () => new URLSearchParams((push.mock.lastCall as [string])[0].slice(1));

  it("starts with every filter off and the extra filters closed", () => {
    bar();
    expect(screen.getByRole("search")).toHaveAttribute("novalidate");
    expect(screen.getByRole("button", { name: /Search/ })).toBeInTheDocument();
    expect(box("Deal")).toBeInTheDocument();
    expect(box("Type")).toBeInTheDocument();
    expect(keyword()).toHaveValue("");
    expect(screen.getByRole("button", { name: "Location" })).toHaveTextContent("City, district");
    expect(screen.getByLabelText("Verified only")).not.toBeChecked();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector(".ant-badge-count")).toBeNull();
  });

  it("shows the active filters and counts the ones behind the button", () => {
    bar({ deal: "rent", city: "ბათუმი", type: "land", priceMin: 1000, priceMax: 2000, rooms: 4, q: "vake", verified: true, areaMin: 40, floorMax: 9 });
    expect(screen.getByText("For rent")).toBeInTheDocument();
    expect(screen.getByText("Land")).toBeInTheDocument();
    expect(keyword()).toHaveValue("vake");
    expect(screen.getByRole("button", { name: "Location" })).toHaveTextContent("Batumi");
    expect(screen.getByLabelText("Verified only")).toBeChecked();
    expect(document.querySelector(".ant-badge-count")).toHaveAttribute("title", "5");
    openMore();
    expect(screen.getByRole("radio", { name: "4+" })).toBeChecked();
    expect(screen.getByLabelText("Price from, $")).toHaveValue("1000");
    expect(screen.getByLabelText("Price to, $")).toHaveValue("2000");
    expect(screen.getByLabelText("Area from, m²")).toHaveValue("40");
    expect(screen.getByLabelText("Floor to")).toHaveValue("9");
  });

  it("marks keyboard use, and forgets it on a mouse press, so only tabbing shows a focus ring", () => {
    bar();
    const form = screen.getByRole("search");
    fireEvent.keyUp(form, { key: "a" });
    expect(form).not.toHaveAttribute("data-keyboard");
    fireEvent.keyUp(form, { key: "Tab" });
    expect(form).toHaveAttribute("data-keyboard");
    fireEvent.mouseDown(form);
    expect(form).not.toHaveAttribute("data-keyboard");
  });

  it("always sends deal and the display choices, so an empty search still shows results", async () => {
    bar({}, { sort: "asc", view: "list", cur: "gel", page: 1 });
    submit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("?deal=&cur=gel&view=list&sort=asc"));
  });

  it("searches with what was chosen in the bar", async () => {
    bar();
    pick("Deal", "For rent");
    pick("Type", "House");
    fireEvent.click(screen.getByLabelText("Verified only"));
    submit();
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(Object.fromEntries(pushed())).toEqual({ deal: "rent", type: "house", verified: "1", cur: "usd", view: "grid", sort: "new" });
  });

  it("drops a filter that was switched back off", async () => {
    bar({ verified: true, q: "vake" });
    fireEvent.click(screen.getByLabelText("Verified only"));
    fireEvent.change(keyword(), { target: { value: "" } });
    submit();
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(pushed().has("verified")).toBe(false);
    expect(pushed().has("q")).toBe(false);
  });

  describe("location picker", () => {
    const openPicker = () => fireEvent.click(screen.getByRole("button", { name: "Location" }));
    // ByText, because ByRole works out accessibility for every node and there are thousands here.
    const picker = () => within(document.querySelector(".ant-modal") as HTMLElement);
    const cityButton = (name: string) => picker().getByText(name, { selector: "button" });
    const city = (name: string) => fireEvent.click(cityButton(name));
    const districtBox = (name: string) => picker().getByText(name).closest("label")?.querySelector("input") as HTMLInputElement;
    const noBox = (name: string) => expect(picker().queryByText(name)).toBeNull();
    const tick = (name: string) => fireEvent.click(districtBox(name));
    const footer = (name: string) => fireEvent.click(within(document.querySelector(".loc-foot") as HTMLElement).getByText(name));
    const apply = () => footer("Search");

    it("asks for a city first, then searches its chosen districts and closes", async () => {
      bar();
      openPicker();
      expect(picker().getByText("Choose a city to see its districts.")).toBeInTheDocument();
      city("Tbilisi");
      expect(picker().queryByText("Choose a city to see its districts.")).toBeNull();
      tick("Vake");
      tick("Vera");
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(Object.fromEntries(pushed())).toMatchObject({ city: "თბილისი", district: "ვაკე,ვერა" });
      expect(screen.getByRole("button", { name: "Location" })).toHaveTextContent("Tbilisi +2");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("searches a whole city when no district is ticked", async () => {
      bar();
      openPicker();
      city("Rustavi");
      expect(document.querySelector(".loc-columns input")).toBeNull();
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().get("city")).toBe("რუსთავი");
      expect(pushed().has("district")).toBe(false);
    });

    it("ticks a whole group at once, shows when it is partly ticked, and unticks it", () => {
      bar({ city: "თბილისი", district: ["ვაკე"] });
      openPicker();
      const group = () => districtBox("Vake-Saburtalo");
      expect(districtBox("Vake")).toBeChecked();
      expect(group()).not.toBeChecked();
      expect(group().closest(".ant-checkbox")).toHaveClass("ant-checkbox-indeterminate");
      fireEvent.click(group());
      expect(group()).toBeChecked();
      expect(districtBox("Saburtalo")).toBeChecked();
      fireEvent.click(group());
      expect(districtBox("Vake")).not.toBeChecked();
      expect(group().closest(".ant-checkbox")).not.toHaveClass("ant-checkbox-indeterminate");
    });

    it("shows plain districts for a city without groups", () => {
      bar();
      openPicker();
      city("Batumi");
      tick("Makhinjauri");
      expect(districtBox("Makhinjauri")).toBeChecked();
    });

    it("narrows cities and districts as you type, in either language", () => {
      bar();
      openPicker();
      fireEvent.change(picker().getByRole("textbox"), { target: { value: "vazis" } });
      expect(cityButton("Tbilisi")).toBeInTheDocument();
      noBox("Gudauri");
      city("Tbilisi");
      expect(districtBox("Vazisubani")).toBeInTheDocument();
      noBox("Vake");
      fireEvent.change(picker().getByRole("textbox"), { target: { value: "ვაზისუბანი" } });
      expect(districtBox("Vazisubani")).toBeInTheDocument();
    });

    it("forgets ticked districts when the city changes, not when it is pressed again", () => {
      bar({ city: "თბილისი", district: ["ვაკე"] });
      openPicker();
      city("Tbilisi");
      expect(districtBox("Vake")).toBeChecked();
      city("Batumi");
      city("Tbilisi");
      expect(districtBox("Vake")).not.toBeChecked();
    });

    it("clears the place, and dismissing forgets what was not applied", async () => {
      bar({ city: "თბილისი", district: ["ვაკე"] });
      openPicker();
      city("Batumi");
      fireEvent.click(document.querySelector(".ant-modal-close") as HTMLElement);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(push).not.toHaveBeenCalled();
      openPicker();
      expect(cityButton("Tbilisi")).toHaveAttribute("aria-pressed", "true");
      footer("Clear");
      expect(picker().getByText("Choose a city to see its districts.")).toBeInTheDocument();
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().has("city")).toBe(false);
    });
  });

  it("applies the extra filters from the panel and closes it", async () => {
    bar();
    openMore();
    fireEvent.click(screen.getByRole("radio", { name: "4+" }));
    fireEvent.change(screen.getByLabelText("Price from, $"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Floor to"), { target: { value: "9" } });
    fireEvent.keyDown(screen.getByLabelText("Floor to"), { key: "Enter", keyCode: 13 });
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(Object.fromEntries(pushed())).toMatchObject({ rooms: "4", priceMin: "500", floorMax: "9" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("turns panel choices back off one at a time", async () => {
    bar({ rooms: 2, priceMin: 100 });
    openMore();
    const panel = within(screen.getByRole("dialog"));
    fireEvent.click(within(panel.getByRole("radiogroup", { name: "Rooms" })).getByRole("radio", { name: "Any" }));
    fireEvent.change(panel.getByLabelText("Price from, $"), { target: { value: "" } });
    fireEvent.click(panel.getByRole("button", { name: /Search/ }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    for (const key of ["rooms", "priceMin"]) expect(pushed().has(key)).toBe(false);
  });

  it("clears only the panel's filters and can be dismissed without searching", async () => {
    bar({ deal: "sale", city: "ბათუმი", priceMax: 100 });
    openMore();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clear" }));
    expect(screen.getByLabelText("Price to, $")).toHaveValue("");
    fireEvent.click(document.querySelector(".ant-modal-close") as HTMLElement);
    expect(push).not.toHaveBeenCalled();
    submit();
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(Object.fromEntries(pushed())).toEqual({ deal: "sale", city: "ბათუმი", cur: "usd", view: "grid", sort: "new" });
  });

  it("writes room counts in full, with the top one as a minimum, in the page language", () => {
    render(<SearchBar locale="ru" t={getDictionary("ru")} filters={{}} display={display} />);
    fireEvent.click(screen.getByRole("button", { name: /Другие фильтры/ }));
    expect(screen.getByRole("radio", { name: "4+" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "3" })).toBeInTheDocument();
  });
});

describe("FilterChips districts", () => {
  it("names one district, and counts the rest", () => {
    const { rerender } = render(<FilterChips locale="en" t={t} query={{}} filters={{ district: ["ვაკე"] }} />);
    expect(screen.getByRole("link", { name: "Remove filter: Vake" })).toBeInTheDocument();
    rerender(<FilterChips locale="en" t={t} query={{}} filters={{ district: ["ვაკე", "ვერა", "ისანი"] }} />);
    expect(screen.getByRole("link", { name: "Remove filter: Vake +2" })).toBeInTheDocument();
  });
});

describe("ListingCard", () => {
  it("leads with the price and builds its title from the facts", () => {
    render(<ListingCard listing={fixtureListings[0]} locale="en" t={t} />);
    expect(screen.getByText("$148,000")).toBeInTheDocument();
    expect(screen.getByText("$1,609 / m²")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "For sale: 3-room apartment, Vake" })).toBeInTheDocument();
    expect(screen.getByText("Nov 6")).toBeInTheDocument();
    expect(screen.getByText("3 rooms")).toBeInTheDocument();
  });

  it("shows the price in the chosen currency", () => {
    render(<ListingCard listing={fixtureListings[0]} locale="en" t={t} cur="gel" />);
    expect(screen.getByText("₾399,600")).toBeInTheDocument();
    expect(screen.getByText("₾4,343 / m²")).toBeInTheDocument();
  });

  it("converts a listing priced in another currency", () => {
    render(<ListingCard listing={fixtureListings[2]} locale="en" t={t} />);
    expect(screen.getByText("$100,000")).toBeInTheDocument();
  });

  it("titles property without rooms by its type alone and shows no price per m² on rentals", () => {
    render(<ListingCard listing={{ ...fixtureListings[1], type: "land", rooms: 0 }} locale="en" t={t} />);
    expect(screen.getByRole("heading", { name: "For rent: land, Saburtalo" })).toBeInTheDocument();
    expect(screen.queryByText(/\/ m²/)).toBeNull();
  });

  it("writes the title in the page language", () => {
    render(<ListingCard listing={fixtureListings[0]} locale="ka" t={getDictionary("ka")} />);
    expect(screen.getByRole("heading", { name: "იყიდება 3 ოთახიანი ბინა, ვაკე" })).toBeInTheDocument();
  });

  it("uses the city when a place has no districts", () => {
    render(<ListingCard listing={{ ...fixtureListings[0], city: "რუსთავი", district: "" }} locale="en" t={t} />);
    expect(screen.getByRole("heading", { name: "For sale: 3-room apartment, Rustavi" })).toBeInTheDocument();
    expect(screen.getByText(fixtureListings[0].address)).toBeInTheDocument();
  });

  it("says who checked a verified listing and when", () => {
    render(<ListingCard listing={{ ...fixtureListings[0], verification: { by: "Nino", at: "2026-11-02" } }} locale="en" t={t} />);
    expect(screen.getByText("Checked by Nino, Nov 2")).toBeInTheDocument();
  });

  it("keeps the chosen currency when the listing is opened", () => {
    const { rerender } = render(<ListingCard listing={fixtureListings[0]} locale="en" t={t} cur="gel" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", `/en/listings/${fixtureListings[0].id}?cur=gel`);
    rerender(<ListingCard listing={fixtureListings[0]} locale="en" t={t} cur="usd" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", `/en/listings/${fixtureListings[0].id}`);
  });

  it("names the broker when there is one", () => {
    render(<ListingCard listing={fixtureListings[0]} locale="en" t={t} />);
    expect(screen.getByText(fixtureListings[0].agent?.name as string)).toBeInTheDocument();
  });

  it("shows how many photos there are", () => {
    render(<ListingCard listing={{ ...fixtureListings[0], images: ["https://cdn/a.jpg", "https://cdn/b.jpg"] }} locale="en" t={t} />);
    expect(screen.getByText("2 photos")).toBeInTheDocument();
  });

  it("shows a verified sale listing with floor", () => {
    const l = fixtureListings[0];
    render(<ListingCard listing={l} locale="en" t={t} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", `/en/listings/${l.id}`);
    expect(screen.getByText("MTeam Verified")).toBeInTheDocument();
    expect(screen.getByText(/7\/12 floor/)).toBeInTheDocument();
  });

  it("shows a rent listing per month, without badge or floor", () => {
    const l: Listing = { ...fixtureListings[1], floor: undefined, verified: false };
    render(<ListingCard listing={l} locale="en" t={t} />);
    expect(screen.getByText("/ month")).toBeInTheDocument();
    expect(screen.queryByText("MTeam Verified")).toBeNull();
    expect(screen.queryByText(/floor/)).toBeNull();
  });
});
