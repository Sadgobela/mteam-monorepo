import { Alert, Linking } from "react-native";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { answer, listing, me, renderApp, serve, signedIn } from "@/test/render";
import ListingScreen from "@/app/listings/[id]";

const { router, useLocalSearchParams } = jest.requireMock("expo-router");
const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
const detail = (overrides = {}, similar: unknown[] = []) => answer({ listing: { ...listing, ...overrides }, similar, gelPerUsd: 2.7 });

beforeEach(() => useLocalSearchParams.mockReturnValue({ id: "7" }));

describe("ListingScreen", () => {
  it("shows the listing in the app's language, with photos and similar listings", async () => {
    serve({ "/api/v1/listings/7": detail({ agent: { id: "a1", name: "Nino", branch: "Vake" } }, [{ ...listing, id: 8, price: 99000 }]) });
    await renderApp(<ListingScreen />);
    expect(await screen.findByText("$120,000")).toBeOnTheScreen();
    expect(screen.getByText("მზიანი ბინა")).toBeOnTheScreen();
    expect(screen.getByText("Nino · Vake")).toBeOnTheScreen();
    expect(screen.getByLabelText("ფოტო 2")).toBeOnTheScreen();
    expect(screen.getByText("1 / 2")).toBeOnTheScreen();
    await fireEvent(screen.getByTestId("gallery"), "momentumScrollEnd", { nativeEvent: { contentOffset: { x: 750 } } });
    expect(screen.getByText("2 / 2")).toBeOnTheScreen();
    expect(screen.getByText("$99,000")).toBeOnTheScreen();
    for (const heart of screen.getAllByRole("button", { name: "რჩეულებში დამატება" })) await fireEvent.press(heart);
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(2));
    expect(router.push).toHaveBeenCalledWith("/login");
  });

  it("names a broker without a branch on its own, with no dangling dot", async () => {
    serve({ "/api/v1/listings/7": detail({ agent: { id: "a1", name: "Nino", branch: "" } }) });
    await renderApp(<ListingScreen />);
    expect(await screen.findByText("Nino")).toBeOnTheScreen();
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
});
