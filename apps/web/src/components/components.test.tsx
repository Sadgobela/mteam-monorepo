import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getDictionary, type Listing } from "@mteam/shared";
import { fixtureListings } from "@/test-fixtures";
import { Header } from "./Header";
import { ListingCard } from "./ListingCard";
import { SearchBar } from "./SearchBar";

vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));

const t = getDictionary("en");

describe("Header", () => {
  it("shows navigation and marks the current language", () => {
    render(<Header locale="en" t={t} signedIn={false} />);
    expect(screen.getByRole("link", { name: "For sale" })).toHaveAttribute("href", "/en?deal=sale");
    expect(screen.getByRole("link", { name: "EN" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "KA" })).not.toHaveAttribute("aria-current");
  });
});

describe("SearchBar", () => {
  it("starts with every filter off", () => {
    render(<SearchBar t={t} filters={{}} />);
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    for (const label of ["Deal", "City", "Type", "Rooms"]) expect(screen.getByLabelText(label)).toHaveValue("");
    expect(screen.getByLabelText("Price from, $")).toHaveValue(null);
    expect(screen.getByLabelText("Price to, $")).toHaveValue(null);
  });

  it("shows the active filters", () => {
    render(
      <SearchBar t={t} filters={{ deal: "rent", city: "dubai", type: "land", priceMin: 1000, priceMax: 2000, rooms: 4 }} />,
    );
    expect(screen.getByLabelText("Deal")).toHaveValue("rent");
    expect(screen.getByLabelText("City")).toHaveValue("dubai");
    expect(screen.getByLabelText("Type")).toHaveValue("land");
    expect(screen.getByLabelText("Price from, $")).toHaveValue(1000);
    expect(screen.getByLabelText("Price to, $")).toHaveValue(2000);
    expect(screen.getByLabelText("Rooms")).toHaveValue("4");
  });

  it("labels options in the page language, and the top room count as a minimum", () => {
    render(<SearchBar t={getDictionary("ru")} filters={{}} />);
    expect(screen.getByRole("option", { name: "Тбилиси" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Посуточно" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Участок" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "4+" })).toHaveValue("4");
    expect(screen.getByRole("option", { name: "3" })).toHaveValue("3");
  });
});

describe("ListingCard", () => {
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
