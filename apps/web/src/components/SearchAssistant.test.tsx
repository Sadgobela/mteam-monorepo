import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";
import { SearchAssistant } from "./SearchAssistant";

const countSearchAction = vi.hoisted(() => vi.fn(async (search: string) => search.length));
vi.mock("@/lib/search-actions", () => ({ countSearchAction }));
vi.mock("@/lib/lead-actions", () => ({ leadAction: vi.fn(async () => ({})) }));

const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const results = () => screen.queryByRole("link", { name: /Show/ });

describe("SearchAssistant", () => {
  it("asks one question at a time and links to the matching results with their count", async () => {
    render(<SearchAssistant locale="en" t={getDictionary("en")} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tell me what you are looking for");
    expect(results()).toBeNull();

    click("Buy");
    expect(screen.getByText("What type of property?")).toBeInTheDocument();
    await waitFor(() => expect(results()).toHaveTextContent("Show 9 listings"));
    expect(results()).toHaveAttribute("href", "/en?deal=sale");

    click("Land");
    click("Any");
    click("Up to $50,000");
    click("Yes, below market only");
    expect(screen.getByText(/Done!/)).toBeInTheDocument();
    const broker = screen.getByText("Can't find it? An MTeam broker will search for you").closest("details")!;
    expect(broker.querySelector<HTMLInputElement>("input[name=search]")!.value).toBe("deal=sale&type=land&priceMax=50000&belowMarket=1");
    expect(broker.querySelector<HTMLInputElement>("input[name=deal]")!.value).toBe("sale");
    expect(screen.getByRole("button", { name: "Have a broker call me" })).toBeInTheDocument();
    expect(results()).toHaveAttribute("href", "/en?deal=sale&type=land&priceMax=50000&belowMarket=1");
    expect(countSearchAction).toHaveBeenLastCalledWith("deal=sale&type=land&priceMax=50000&belowMarket=1");
  });

  it("shows a plain button until the count arrives, and goes back to a changed answer", async () => {
    countSearchAction.mockReturnValueOnce(new Promise(() => undefined));
    render(<SearchAssistant locale="en" t={getDictionary("en")} />);
    click("Rent");
    expect(results()).toHaveTextContent("Show results");
    expect(screen.queryByText(/An MTeam broker/)).toBeNull();

    click("Apartment");
    click("Change answer: Rent");
    expect(screen.getByText("What are you looking for?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change answer: Apartment" })).toBeNull();

    click("Daily rental");
    click("Start over");
    expect(results()).toBeNull();
    expect(screen.getByRole("button", { name: "Buy" })).toBeInTheDocument();
  });
});
