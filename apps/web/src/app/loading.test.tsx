import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import HomeLoading from "./[locale]/(home)/loading";
import ListingLoading from "./[locale]/listings/[id]/loading";
import AccountLoading from "./[locale]/(account)/loading";
import AccountPagesLoading from "./[locale]/(account)/account/loading";
import SavedLoading from "./[locale]/(account)/saved/loading";
import MyListingsLoading from "./[locale]/(account)/my-listings/loading";
import MessagesLoading from "./[locale]/(account)/messages/loading";
import FavoritesLoading from "./[locale]/(account)/favorites/loading";

const shown = (Loading: () => React.ReactNode) => render(<>{Loading()}</>).container;

describe("loading pages", () => {
  it("shows the header and a grid of card shapes while the home page or a search opens", () => {
    const page = shown(HomeLoading);
    expect(page.querySelector("header.nav .logo")).not.toBeNull();
    expect(page.querySelector("main")).toHaveAttribute("aria-busy", "true");
    expect(page.querySelectorAll(".cards .skeleton-card")).toHaveLength(8);
    // Shapes only: nothing to read before the page arrives.
    expect(page.querySelector("main")).toHaveTextContent("");
  });

  it("shows the gallery, title and contact box shapes while a listing opens", () => {
    const page = shown(ListingLoading);
    expect(page.querySelector("header.nav")).not.toBeNull();
    expect(page.querySelector("main.listing")).toHaveAttribute("aria-busy", "true");
    expect(page.querySelector(".skeleton-gallery")).not.toBeNull();
    expect(page.querySelector(".side .agent .ant-skeleton")).not.toBeNull();
  });

  it.each([
    ["the account area", AccountLoading, 4],
    ["profile, settings and notifications", AccountPagesLoading, 4],
    ["saved searches", SavedLoading, 4],
    ["messages", MessagesLoading, 5],
  ])("shows rows of shapes inside the sidebar for %s", (_name, Loading, rows) => {
    const page = shown(Loading);
    expect(page.querySelector("main.account-main")).toHaveAttribute("aria-busy", "true");
    expect(page.querySelector(".skeleton-heading")).not.toBeNull();
    expect(page.querySelectorAll(".skeleton-rows > li")).toHaveLength(rows);
    expect(page.querySelector(".skeleton-thumb")).toBeNull();
  });

  it("gives my listings a photo in each row", () => {
    const page = shown(MyListingsLoading);
    expect(page.querySelector("main.account-main.narrow")).toHaveAttribute("aria-busy", "true");
    expect(page.querySelectorAll(".skeleton-rows .skeleton-thumb")).toHaveLength(4);
  });

  it("shows card shapes for favourites", () => {
    const page = shown(FavoritesLoading);
    expect(page.querySelectorAll(".cards .skeleton-card")).toHaveLength(4);
  });
});
