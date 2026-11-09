import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getDictionary, type Listing } from "@mteam/shared";
import { fixtureListings } from "@/test-fixtures";
import { FilterChips } from "./FilterChips";
import { Header } from "./Header";
import { ListingCard } from "./ListingCard";
import { SearchBar } from "./SearchBar";

vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));

const t = getDictionary("en");

describe("Header", () => {
  it("shows navigation and marks the current language", () => {
    render(<Header locale="en" t={t} signedIn={false} />);
    expect(screen.getByRole("link", { name: "For sale" })).toHaveAttribute("href", "/en?deal=sale");
    expect(screen.getByRole("link", { name: "mTeam Verified" })).toHaveAttribute("href", "/en?verified=1");
    expect(screen.getByRole("link", { name: "EN" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "KA" })).not.toHaveAttribute("aria-current");
  });
});

describe("FilterChips", () => {
  const all = {
    deal: "rent",
    type: "land",
    city: "dubai",
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
    render(<FilterChips locale="en" t={t} query={{ deal: "rent", city: "dubai", page: "3" }} filters={all} />);
    expect(screen.getAllByRole("link")).toHaveLength(12);
    expect(screen.getByRole("link", { name: "Remove filter: Floor from 3" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Remove filter: Dubai" })).toHaveAttribute("href", "/en?deal=rent&city=&page=1");
    expect(screen.getByRole("link", { name: "Remove filter: Area from, m² 40" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Remove filter: marina" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Remove filter: mTeam Verified" })).toBeInTheDocument();
  });
});

describe("SearchBar", () => {
  const display = { sort: "new", view: "grid", cur: "usd", page: 1 } as const;

  it("starts with every filter off and the extra filters closed", () => {
    const { container } = render(<SearchBar t={t} filters={{}} display={display} />);
    expect(screen.getByRole("search")).toHaveAttribute("novalidate");
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    for (const label of ["Deal", "Type", "City", "Rooms"]) expect(screen.getByLabelText(label)).toHaveValue("");
    expect(screen.getByLabelText("Location")).toHaveValue("");
    expect(screen.getByLabelText("Verified only")).not.toBeChecked();
    expect(container.querySelector("details")).not.toHaveAttribute("open");
  });

  it("shows the active filters and opens the extra filters when one is in use", () => {
    const { container } = render(
      <SearchBar t={t} filters={{ deal: "rent", city: "dubai", type: "land", priceMin: 1000, priceMax: 2000, rooms: 4, q: "vake", verified: true, areaMin: 40, floorMax: 9 }} display={display} />,
    );
    expect(screen.getByLabelText("Deal")).toHaveValue("rent");
    expect(screen.getByLabelText("City")).toHaveValue("dubai");
    expect(screen.getByLabelText("Type")).toHaveValue("land");
    expect(screen.getByLabelText("Price from, $")).toHaveValue(1000);
    expect(screen.getByLabelText("Price to, $")).toHaveValue(2000);
    expect(screen.getByLabelText("Rooms")).toHaveValue("4");
    expect(screen.getByLabelText("Location")).toHaveValue("vake");
    expect(screen.getByLabelText("Area from, m²")).toHaveValue(40);
    expect(screen.getByLabelText("Floor to")).toHaveValue(9);
    expect(screen.getByLabelText("Verified only")).toBeChecked();
    expect(container.querySelector("details")).toHaveAttribute("open");
  });

  it("carries the display choices through a new search", () => {
    const { container } = render(<SearchBar t={t} filters={{}} display={{ ...display, cur: "gel", view: "list", sort: "asc" }} />);
    const hidden = (name: string) => container.querySelector(`input[type=hidden][name=${name}]`);
    expect(hidden("cur")).toHaveValue("gel");
    expect(hidden("view")).toHaveValue("list");
    expect(hidden("sort")).toHaveValue("asc");
    expect(hidden("page")).toBeNull();
  });

  it("labels options in the page language, and the top room count as a minimum", () => {
    render(<SearchBar t={getDictionary("ru")} filters={{}} display={display} />);
    expect(screen.getByRole("option", { name: "Тбилиси" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Посуточно" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Участок" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "4+" })).toHaveValue("4");
    expect(screen.getByRole("option", { name: "3" })).toHaveValue("3");
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
    expect(screen.getByText("$394,826")).toBeInTheDocument();
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

  it("leaves the place out of the title when the city is not one we know", () => {
    render(<ListingCard listing={{ ...fixtureListings[0], city: "Kutaisi", district: "Unknown" }} locale="en" t={t} />);
    expect(screen.getByRole("heading", { name: "For sale: 3-room apartment" })).toBeInTheDocument();
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
    expect(screen.getByText("mTeam Verified")).toBeInTheDocument();
    expect(screen.getByText(/7\/12 floor/)).toBeInTheDocument();
  });

  it("shows a rent listing per month, without badge or floor", () => {
    const l: Listing = { ...fixtureListings[1], floor: undefined, verified: false };
    render(<ListingCard listing={l} locale="en" t={t} />);
    expect(screen.getByText("/ month")).toBeInTheDocument();
    expect(screen.queryByText("mTeam Verified")).toBeNull();
    expect(screen.queryByText(/floor/)).toBeNull();
  });
});
