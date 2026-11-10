import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";
import { LoanCalculator } from "./LoanCalculator";
import { PhoneReveal } from "./PhoneReveal";
import { ReportListing } from "./ReportListing";
import { ShareButton } from "./ShareButton";

const action = vi.hoisted(() => vi.fn());
vi.mock("@/lib/report-actions", () => ({ reportListingAction: action }));

const t = getDictionary("en");

afterEach(() => {
  vi.unstubAllGlobals();
  action.mockReset();
});

describe("PhoneReveal", () => {
  const stub = (body: object, ok = true) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok, json: async () => body })));

  it("shows only the masked number until asked, then fetches the real one", async () => {
    stub({ phone: "+995 555 12 34 56" });
    render(<PhoneReveal listingId={7} masked="+995 555 12 3* **" t={t} />);
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Show number/ }));
    expect(await screen.findByRole("link", { name: "+995 555 12 34 56" })).toHaveAttribute("href", "tel:+995 555 12 34 56");
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/995555123456");
    expect(fetch).toHaveBeenCalledWith("/api/listings/7/phone");
  });

  it("stays on the button if the number cannot be fetched", async () => {
    stub({}, false);
    render(<PhoneReveal listingId={7} masked="***" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: /Show number/ }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /Show number/ })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("PhoneReveal offline", () => {
  it("goes back to the button when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    render(<PhoneReveal listingId={7} masked="***" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: /Show number/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Show number/ })).not.toHaveClass("ant-btn-loading"));
  });
});

describe("ShareButton", () => {
  const setNavigator = (value: object) => vi.stubGlobal("navigator", value);

  it("uses the phone's share sheet when there is one, and survives it being dismissed", async () => {
    const share = vi.fn(async () => Promise.reject(new Error("dismissed")));
    setNavigator({ share });
    render(<ShareButton title="Flat" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: "Flat", url: window.location.href }));
  });

  it("copies the link otherwise and says so", async () => {
    const writeText = vi.fn(async () => undefined);
    setNavigator({ clipboard: { writeText } });
    render(<ShareButton title="Flat" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("button", { name: "Link copied" })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });
});

describe("LoanCalculator", () => {
  it("starts from the listing price and recalculates", () => {
    render(<LoanCalculator price={100000} symbol="$" t={t} />);
    expect(screen.getByText("$826")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Annual rate, %"), { target: { value: "0" } });
    expect(screen.getByText("$333")).toBeInTheDocument();
  });
});

describe("ReportListing", () => {
  const open = () => {
    render(<ReportListing listingId={7} t={t} />);
    fireEvent.click(screen.getByRole("button", { name: "Report" }));
  };

  it("sends the reason and thanks the visitor", async () => {
    action.mockResolvedValue({ sent: true });
    open();
    const dialog = within(screen.getByRole("dialog"));
    const form = (dialog.getByRole("button", { name: "Send" }) as HTMLButtonElement).form as HTMLFormElement;
    (form.querySelector("input[name=reason]") as HTMLInputElement).required = false;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Thank you");
    expect((action.mock.calls[0][1] as FormData).get("listingId")).toBe("7");
  });

  it("says when the report was not valid", async () => {
    action.mockResolvedValue({ invalid: true });
    open();
    await act(async () => {
      fireEvent.submit((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).form as HTMLFormElement);
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a reason");
  });

  it("can be dismissed", async () => {
    open();
    fireEvent.click(document.querySelector(".ant-modal-close") as Element);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
