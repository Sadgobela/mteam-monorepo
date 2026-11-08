import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { getDictionary, type Listing } from "@mteam/shared";
import { fixtureListings } from "@/test-fixtures";
import { Header } from "./Header";
import { ListingCard } from "./ListingCard";
import { SearchBar } from "./SearchBar";

const t = getDictionary("en");

describe("Header", () => {
  it("shows navigation and marks the current language", () => {
    render(<Header locale="en" t={t} />);
    expect(screen.getByRole("link", { name: "For sale" })).toHaveAttribute("href", "/en?deal=sale");
    expect(screen.getByRole("link", { name: "EN" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "KA" })).not.toHaveAttribute("aria-current");
  });
});

describe("SearchBar", () => {
  it("renders the search fields", () => {
    render(<SearchBar t={t} />);
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
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
