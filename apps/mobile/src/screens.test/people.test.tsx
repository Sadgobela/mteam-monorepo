import { Alert, Linking } from "react-native";
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { getDictionary, METRO_CITY, popularCities } from "@mteam/shared";
import { answer, listing, renderApp, serve } from "@/test/render";
import BranchScreen from "@/app/branches/[id]";
import BrokerScreen from "@/app/brokers/[id]";
import BrokersScreen from "@/app/brokers/index";
import MortgageScreen from "@/app/mortgage";
import PricesScreen from "@/app/prices";
import SellerScreen from "@/app/sellers/[id]";

const { router, useLocalSearchParams } = jest.requireMock("expo-router");
const openURL = jest.spyOn(Linking, "openURL");
const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
const t = getDictionary("ka");

const nino = { id: "b1", name: "ნინო ბერიძე", branch: "ვაკის ფილიალი", listingCount: 4 };
const branch = { id: "vake", name: "ვაკის ფილიალი", city: METRO_CITY, brokerCount: 2, listingCount: 9 };

afterEach(() => useLocalSearchParams.mockReturnValue({}));

describe("BrokersScreen", () => {
  it("lists the branches and the brokers, each opening its page, and retries a failure", async () => {
    serve({ "/api/v1/brokers": [new TypeError("offline"), answer({ branches: [branch], brokers: [nino, { ...nino, id: "b2", name: "Giorgi", branch: "" }] })] });
    await renderApp(<BrokersScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    expect(await screen.findByRole("header", { name: "ფილიალები" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "ვაკის ფილიალი. თბილისი · ბროკერები: 2 · განცხადებები: 9" }));
    expect(router.push).toHaveBeenCalledWith("/branches/vake");
    const row = screen.getByRole("button", { name: "ნინო ბერიძე. ვაკის ფილიალი · განცხადებები: 4" });
    // Georgian initials stay as they are.
    expect(within(row).getByText("ნბ", { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith("/brokers/b1");
    // A broker without a branch has only the count.
    expect(screen.getByRole("button", { name: "Giorgi. განცხადებები: 4" })).toBeOnTheScreen();
  });

  it("leaves out the branches when there are none, and says when there are no brokers", async () => {
    serve({ "/api/v1/brokers": [answer({ branches: [], brokers: [nino] }), answer({ branches: [], brokers: [] })] });
    const view = await renderApp(<BrokersScreen />);
    expect(await screen.findByRole("header", { name: "ბროკერები" })).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "ფილიალები" })).not.toBeOnTheScreen();
    await view.unmount();
    await renderApp(<BrokersScreen />);
    expect(await screen.findByText(t.brokers.empty)).toBeOnTheScreen();
  });
});

describe("BrokerScreen", () => {
  beforeEach(() => useLocalSearchParams.mockReturnValue({ id: "b1" }));

  it("shows the broker with a call, WhatsApp, the bio and the listings", async () => {
    openURL.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("no app"));
    serve({
      "/api/v1/brokers/b1": answer({ broker: { id: "b1", name: "Nino", branch: "Vake", phone: "+995555123456", photoUrl: "https://cdn.test/nino.webp", bio: "ათი წელი ვაკეში" }, listings: [listing], gelPerUsd: 2.7 }),
    });
    await renderApp(<BrokerScreen />);
    expect(await screen.findByRole("header", { name: "Nino" })).toBeOnTheScreen();
    expect(screen.getByText("MTeam ბროკერი · Vake")).toBeOnTheScreen();
    expect(screen.getByText("ათი წელი ვაკეში")).toBeOnTheScreen();
    expect(screen.getByText("$120,000")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "დარეკვა" }));
    await waitFor(() => expect(openURL).toHaveBeenCalledWith("tel:+995555123456"));
    await fireEvent.press(screen.getByRole("button", { name: "WhatsApp" }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(t.mobile.callFailed));
    expect(openURL).toHaveBeenLastCalledWith("https://wa.me/995555123456");
  });

  it("does without a branch, a bio and listings, and retries a failure", async () => {
    serve({ "/api/v1/brokers/b1": [new TypeError("offline"), answer({ broker: { id: "b1", name: "Nino", branch: "", phone: "+995555123456", photoUrl: null, bio: null }, listings: [], gelPerUsd: 2.7 })] });
    await renderApp(<BrokerScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    expect(await screen.findByText("MTeam ბროკერი")).toBeOnTheScreen();
    expect(screen.getByText("N", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText(t.search.empty)).toBeOnTheScreen();
  });
});

describe("BranchScreen", () => {
  it("shows the branch's city, its brokers and its listings", async () => {
    useLocalSearchParams.mockReturnValue({ id: "vake" });
    serve({ "/api/v1/branches/vake": [new TypeError("offline"), answer({ branch: { id: "vake", name: "ვაკის ფილიალი", city: METRO_CITY }, brokers: [nino], listings: [listing], gelPerUsd: 2.7 })] });
    await renderApp(<BranchScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    expect(await screen.findByRole("header", { name: "ვაკის ფილიალი" })).toBeOnTheScreen();
    expect(screen.getByText("თბილისი")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: /^ნინო ბერიძე/ }));
    expect(router.push).toHaveBeenCalledWith("/brokers/b1");
    expect(screen.getByText("$120,000")).toBeOnTheScreen();
  });
});

describe("SellerScreen", () => {
  beforeEach(() => useLocalSearchParams.mockReturnValue({ id: "u1" }));

  it("shows the seller's name and listings, or only the heading without a name", async () => {
    serve({
      "/api/v1/sellers/u1": [
        new TypeError("offline"),
        answer({ seller: { name: "Nino", avatarUrl: null }, listings: [listing], gelPerUsd: 2.7 }),
        answer({ seller: { name: null, avatarUrl: null }, listings: [listing], gelPerUsd: 2.7 }),
      ],
    });
    const view = await renderApp(<SellerScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    expect(await screen.findByRole("header", { name: "Nino" })).toBeOnTheScreen();
    expect(screen.getByText(t.listing.sellerHeading)).toBeOnTheScreen();
    await view.unmount();
    await renderApp(<SellerScreen />);
    expect(await screen.findByRole("header", { name: t.listing.sellerHeading })).toBeOnTheScreen();
    expect(screen.getByText("$120,000")).toBeOnTheScreen();
  });
});

describe("MortgageScreen", () => {
  it("works out a monthly payment from typical terms, and again when they change", async () => {
    serve({});
    await renderApp(<MortgageScreen />);
    expect(screen.getByLabelText("ფასი, $")).toHaveDisplayValue("100000");
    const monthly = screen.getByTestId("monthly");
    const before = String(monthly.props.children);
    await fireEvent.changeText(screen.getByLabelText(t.listing.loanYears), "10");
    expect(String(screen.getByTestId("monthly").props.children)).not.toBe(before);
  });
});

describe("PricesScreen", () => {
  it("shows the table for Tbilisi sales, with a dash where there is no price, and asks again for another city or deal", async () => {
    const fetchMock = serve({
      "/api/v1/prices": [
        new TypeError("offline"),
        answer({ city: METRO_CITY, deal: "sale", stats: [{ district: "ვაკე", rooms: 1, median: 1850 }, { district: "ვაკე", rooms: 4, median: 2100 }, { district: "საბურთალო", rooms: 2, median: 1300 }] }),
        answer({ city: METRO_CITY, deal: "rent", stats: [] }),
      ],
    });
    await renderApp(<PricesScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    const table = await screen.findByTestId("prices");
    expect(within(table).getByText("$1,850")).toBeOnTheScreen();
    expect(within(table).getByText("4+ ოთახი")).toBeOnTheScreen();
    expect(within(table).getByText("საბურთალო")).toBeOnTheScreen();
    expect(within(table).getAllByText("–")).toHaveLength(5);
    expect(new URL(fetchMock.mock.calls.at(-1)[0]).searchParams.get("deal")).toBe("sale");

    await fireEvent.press(screen.getByRole("button", { name: "ქირავდება" }));
    expect(await screen.findByText(t.market.statsEmpty)).toBeOnTheScreen();
    expect(new URL(fetchMock.mock.calls.at(-1)[0]).searchParams.get("deal")).toBe("rent");

    // The chosen city pressed again stays chosen; another one is asked for.
    const calls = fetchMock.mock.calls.length;
    await fireEvent.press(screen.getAllByText(METRO_CITY)[0]);
    expect(fetchMock.mock.calls.length).toBe(calls);
    const other = popularCities[1];
    await fireEvent.press(screen.getByText(other));
    await waitFor(() => expect(new URL(fetchMock.mock.calls.at(-1)[0]).searchParams.get("city")).toBe(other));
  });
});
