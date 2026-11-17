import { Alert, Linking } from "react-native";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { answer, listing, me, renderApp, serve, signedIn } from "@/test/render";
import ListingScreen from "@/app/listings/[id]";

const { router, useLocalSearchParams } = jest.requireMock("expo-router");
const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
const detail = (overrides = {}, similar: unknown[] = [], sellerCount = 1) => answer({ listing: { ...listing, ...overrides }, similar, sellerCount, gelPerUsd: 2.7 });

beforeEach(() => useLocalSearchParams.mockReturnValue({ id: "7" }));

describe("ListingScreen", () => {
  it("shows the listing in the app's language, with photos and similar listings", async () => {
    serve({ "/api/v1/listings/7": detail({ agent: { id: "a1", name: "Nino", branch: "Vake" } }, [{ ...listing, id: 8, price: 99000 }]) });
    await renderApp(<ListingScreen />);
    expect(await screen.findByText("$120,000")).toBeOnTheScreen();
    expect(screen.getByText("მზიანი ბინა")).toBeOnTheScreen();
    expect(screen.getByText("MTeam ბროკერი · Vake")).toBeOnTheScreen();
    expect(screen.getByLabelText("ფოტო 2")).toBeOnTheScreen();
    expect(screen.getByText("1 / 2")).toBeOnTheScreen();
    await fireEvent(screen.getByTestId("gallery"), "momentumScrollEnd", { nativeEvent: { contentOffset: { x: 750 } } });
    expect(screen.getByText("2 / 2")).toBeOnTheScreen();
    expect(screen.getByText("$99,000")).toBeOnTheScreen();
    for (const heart of screen.getAllByRole("button", { name: "რჩეულებში დამატება" })) await fireEvent.press(heart);
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(2));
    expect(router.push).toHaveBeenCalledWith("/login");
    // The broker's card opens the broker's page.
    await fireEvent.press(screen.getByRole("link", { name: "Nino" }));
    expect(router.push).toHaveBeenLastCalledWith("/brokers/a1");
    expect(screen.queryByRole("link", { name: /ყველა განცხადება/ })).not.toBeOnTheScreen();
  });

  it("names a broker without a branch on its own, with no dangling dot", async () => {
    serve({ "/api/v1/listings/7": detail({ agent: { id: "a1", name: "Nino", branch: "" } }) });
    await renderApp(<ListingScreen />);
    expect(await screen.findByText("MTeam ბროკერი")).toBeOnTheScreen();
  });

  it("links an owner's other listings when there are more, and works out a loan for a sale", async () => {
    serve({ "/api/v1/listings/7": [detail({}, [], 3), detail({ deal: "rent", price: 1000 })] });
    const view = await renderApp(<ListingScreen />);
    await fireEvent.press(await screen.findByRole("link", { name: "ყველა განცხადება (3)" }));
    expect(router.push).toHaveBeenCalledWith("/sellers/u1");
    expect(screen.getByRole("header", { name: "სესხის კალკულატორი" })).toBeOnTheScreen();
    expect(screen.getByLabelText("ფასი, $")).toHaveDisplayValue("120000");
    await view.unmount();
    await renderApp(<ListingScreen />);
    expect(await screen.findByText("$1,000 / თვე")).toBeOnTheScreen();
    expect(screen.queryByRole("link", { name: /ყველა განცხადება/ })).not.toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "სესხის კალკულატორი" })).not.toBeOnTheScreen();
  });

  it("calls and opens WhatsApp with the number it asks for at the press", async () => {
    serve({ "/api/v1/listings/7": detail(), "/api/listings/7/phone": answer({ phone: "+995555123456" }) });
    await renderApp(<ListingScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "დარეკვა" }));
    await waitFor(() => expect(openURL).toHaveBeenCalledWith("tel:+995555123456"));
    await fireEvent.press(screen.getByRole("button", { name: "WhatsApp" }));
    await waitFor(() => expect(openURL).toHaveBeenCalledWith("https://wa.me/995555123456"));
  });

  it("says when the number cannot be had, and hides the buttons for a chat-only listing", async () => {
    serve({ "/api/v1/listings/7": [detail({ address: "" }), detail({ hidePhone: true, verified: false })], "/api/listings/7/phone": answer({ error: "tooMany" }, 429) });
    const view = await renderApp(<ListingScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "დარეკვა" }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("ნომერი ვერ მივიღეთ. სცადეთ ცოტა ხანში."));
    await view.unmount();
    await renderApp(<ListingScreen />);
    expect(await screen.findByText("$120,000")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "დარეკვა" })).not.toBeOnTheScreen();
    expect(screen.queryByText("MTeam Verified")).not.toBeOnTheScreen();
  });

  it("lets a signed-in user keep the listing", async () => {
    serve({ "/api/v1/me": answer(signedIn({ favoriteIds: [7] })), "/api/v1/listings/7": detail(), "PUT /api/v1/favorites/7": answer({ id: 7, favorite: false }) });
    await renderApp(<ListingScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "რჩეულებიდან ამოღება" }));
    expect(await screen.findByRole("button", { name: "რჩეულებში დამატება" })).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
    expect(me.id).toBe("u1");
  });

  it("says when the listing is gone, and retries after a failure", async () => {
    serve({ "/api/v1/listings/7": [answer({ error: "notFound" }, 404)] });
    const view = await renderApp(<ListingScreen />);
    expect(await screen.findByText("ეს განცხადება აღარ არის გამოქვეყნებული.")).toBeOnTheScreen();
    await view.unmount();
    serve({ "/api/v1/listings/7": [new TypeError("offline"), detail()] });
    await renderApp(<ListingScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    expect(await screen.findByText("$120,000")).toBeOnTheScreen();
  });

  it("writes to the seller: a signed-out user signs in first, and sending opens the chat", async () => {
    serve({ "/api/v1/listings/7": detail() });
    const view = await renderApp(<ListingScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "მიწერა" }));
    expect(router.push).toHaveBeenCalledWith("/login");
    await view.unmount();

    const started = jest.fn((_body: unknown) => answer({ id: "c9" }));
    serve({
      "/api/v1/me": answer(signedIn({ id: "u2", favoriteIds: [7] })),
      "/api/v1/listings/7": detail(),
      "POST /api/v1/conversations": [answer({ error: "failed" }, 422), (init) => started(JSON.parse(String(init.body)))],
    });
    await renderApp(<ListingScreen />);
    await screen.findByRole("button", { name: "რჩეულებიდან ამოღება" });
    await fireEvent.press(screen.getByRole("button", { name: "მიწერა" }));
    expect(screen.getByRole("button", { name: "გაგზავნა" })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("მისწერე გამყიდველს"), " ჯერ კიდევ იყიდება? ");
    await fireEvent.press(screen.getByRole("button", { name: "გაგზავნა" }));
    expect(await screen.findByText("ვერ გაიგზავნა. სცადე ცოტა ხანში.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "გაგზავნა" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/messages/c9"));
    expect(started).toHaveBeenCalledWith({ listingId: 7, body: "ჯერ კიდევ იყიდება?" });
    // Sent, the box closes back into the button.
    expect(screen.getByRole("button", { name: "მიწერა" })).toBeOnTheScreen();
    expect(screen.queryByText("ვერ გაიგზავნა. სცადე ცოტა ხანში.")).not.toBeOnTheScreen();
  });

  it("does not offer writing on the user's own listing, nor to a broker on their agency's", async () => {
    serve({ "/api/v1/me": answer(signedIn({ favoriteIds: [7] })), "/api/v1/listings/7": detail() });
    const view = await renderApp(<ListingScreen />);
    await screen.findByRole("button", { name: "რჩეულებიდან ამოღება" });
    expect(screen.queryByRole("button", { name: "მიწერა" })).not.toBeOnTheScreen();
    await view.unmount();

    const agent = { id: "a1", name: "Ana", branch: "Vake" };
    serve({ "/api/v1/me": answer(signedIn({ id: "u2", agentId: "a1", favoriteIds: [7] })), "/api/v1/listings/7": [detail({ agent }), detail({ agent: { ...agent, id: "a2" } })] });
    const broker = await renderApp(<ListingScreen />);
    await screen.findByRole("button", { name: "რჩეულებიდან ამოღება" });
    expect(screen.queryByRole("button", { name: "მიწერა" })).not.toBeOnTheScreen();
    await broker.unmount();
    // Another agency's listing is someone else's.
    await renderApp(<ListingScreen />);
    await screen.findByRole("button", { name: "რჩეულებიდან ამოღება" });
    expect(screen.getByRole("button", { name: "მიწერა" })).toBeOnTheScreen();
  });
});
