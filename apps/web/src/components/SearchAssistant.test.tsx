import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";
import { SearchAssistant } from "./SearchAssistant";

const countSearchAction = vi.hoisted(() => vi.fn(async (search: string) => search.length));
const askAssistantAction = vi.hoisted(() => vi.fn());
vi.mock("@/lib/search-actions", () => ({ countSearchAction, askAssistantAction }));
vi.mock("@/lib/lead-actions", () => ({ leadAction: vi.fn(async () => ({})) }));

const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const results = () => screen.queryByRole("link", { name: /Show/ });

describe("SearchAssistant", () => {
  it("asks one question at a time and links to the matching results with their count", async () => {
    render(<SearchAssistant gelPerUsd={2.7} locale="en" t={getDictionary("en")} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tell me what you are looking for");
    expect(screen.queryByRole("textbox")).toBeNull();
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
    render(<SearchAssistant gelPerUsd={2.7} locale="en" t={getDictionary("en")} />);
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

  it("reads typed text, shows what it understood and asks only what is left", async () => {
    askAssistantAction.mockResolvedValueOnce({ search: "deal=sale&type=apartment&city=თბილისი&rooms=2&priceMax=120000" });
    render(<SearchAssistant gelPerUsd={2.7} locale="en" t={getDictionary("en")} ai />);
    expect(screen.getByText(/Tell me what property you want/)).toBeInTheDocument();
    const box = screen.getByRole("textbox", { name: "Describe what you are looking for" });

    fireEvent.submit(box.closest("form")!);
    expect(askAssistantAction).not.toHaveBeenCalled();

    fireEvent.change(box, { target: { value: "2-room flat in Tbilisi up to 120k" } });
    fireEvent.submit(box.closest("form")!);
    await waitFor(() => expect(screen.getByText(/Got it, searching for:/)).toHaveTextContent("For sale · Apartment · Tbilisi"));
    expect(askAssistantAction).toHaveBeenCalledWith("2-room flat in Tbilisi up to 120k", "");
    expect(box).toHaveValue("");
    expect(screen.getByText("Which district?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change answer: 2-room flat in Tbilisi up to 120k" })).toBeInTheDocument();

    click("Any");
    click("New building");
    askAssistantAction.mockResolvedValueOnce({ search: "deal=rent" });
    fireEvent.change(box, { target: { value: "actually rent" } });
    fireEvent.submit(box.closest("form")!);
    await waitFor(() => expect(results()).toHaveAttribute("href", "/en?deal=rent"));
    expect(askAssistantAction).toHaveBeenLastCalledWith("actually rent", expect.stringContaining("building=new"));
  });

  it("explains when typed text cannot be used", async () => {
    askAssistantAction.mockResolvedValueOnce({ error: "busy" });
    render(<SearchAssistant gelPerUsd={2.7} locale="en" t={getDictionary("en")} ai />);
    const box = screen.getByRole("textbox");
    fireEvent.change(box, { target: { value: "flat" } });
    fireEvent.submit(box.closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many questions");
    expect(box).toHaveValue("flat");
    click("Buy");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
