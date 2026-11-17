import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Device from "expo-device";
import { answer, listing, renderApp, serve, signedIn } from "@/test/render";
import AccountScreen from "@/app/(tabs)/account";
import FavoritesScreen from "@/app/(tabs)/favorites";

const { router } = jest.requireMock("expo-router");
const notifications = jest.requireMock("expo-notifications");
const device = Device as { isDevice: boolean };

describe("AccountScreen", () => {
  it("offers sign-in, the brokers, the mortgage calculator, prices and the language to a signed-out user", async () => {
    serve({});
    await renderApp(<AccountScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "შესვლა" }));
    expect(router.push).toHaveBeenCalledWith("/login");
    expect(screen.queryByRole("button", { name: "პროფილი" })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "ბროკერები" }));
    expect(router.push).toHaveBeenCalledWith("/brokers");
    await fireEvent.press(screen.getByRole("button", { name: "იპოთეკა" }));
    expect(router.push).toHaveBeenCalledWith("/mortgage");
    await fireEvent.press(screen.getByRole("button", { name: "ფასები" }));
    expect(router.push).toHaveBeenCalledWith("/prices");
    await fireEvent.press(screen.getByText("English"));
    expect(await screen.findByText("App language")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("English"));
    expect(screen.getByText("App language")).toBeOnTheScreen();
  });

  it("greets a signed-in user, turns push on and off, and signs out", async () => {
    const fetchMock = serve({ "/api/v1/me": answer(signedIn()), "/api/v1/push": answer({ ok: true }), "/api/v1/auth/logout": answer({ ok: true }) });
    await renderApp(<AccountScreen />);
    expect(await screen.findByText("გამარჯობა, Nino")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "ჩემი განცხადებები" }));
    expect(router.push).toHaveBeenCalledWith("/my-listings");
    await fireEvent.press(screen.getByRole("button", { name: "მიმოწერა" }));
    expect(router.push).toHaveBeenCalledWith("/messages");
    await fireEvent.press(screen.getByRole("button", { name: "შენახული ძიებები" }));
    expect(router.push).toHaveBeenCalledWith("/saved-searches");
    await fireEvent.press(screen.getByRole("button", { name: "პროფილი" }));
    expect(router.push).toHaveBeenCalledWith("/profile");
    await fireEvent.press(screen.getByRole("button", { name: "პარამეტრები" }));
    expect(router.push).toHaveBeenCalledWith("/settings");

    const toggle = screen.getByLabelText("შეტყობინებები ამ ტელეფონზე");
    await fireEvent(toggle, "valueChange", true);
    await waitFor(() => expect(toggle).toHaveProp("value", true));
    const store = jest.requireMock("expo-secure-store");
    store.getItemAsync.mockImplementation(async (key: string): Promise<string | null> => (key === "pushToken" ? "ExponentPushToken[test]" : "tok"));
    await fireEvent(toggle, "valueChange", false);
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true));
    await fireEvent.press(screen.getByRole("button", { name: "გასვლა" }));
    expect(await screen.findByRole("button", { name: "შესვლა" })).toBeOnTheScreen();
  });

  it("explains when push is blocked or unavailable, and leads a new account to onboarding", async () => {
    serve({ "/api/v1/me": answer(signedIn({ name: null, phone: null, onboarded: false })) });
    await renderApp(<AccountScreen />);
    expect(await screen.findByText("ანგარიში")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "დაასრულე ანგარიშის შექმნა" }));
    expect(router.push).toHaveBeenCalledWith("/onboarding");
    notifications.getPermissionsAsync.mockResolvedValueOnce({ status: "denied" });
    notifications.requestPermissionsAsync.mockResolvedValueOnce({ status: "denied" });
    const toggle = screen.getByLabelText("შეტყობინებები ამ ტელეფონზე");
    await fireEvent(toggle, "valueChange", true);
    expect(await screen.findByText("შეტყობინებები ტელეფონის პარამეტრებშია გამორთული. იქ ჩართე MTeam-ისთვის.")).toBeOnTheScreen();
    device.isDevice = false;
    await fireEvent(toggle, "valueChange", true);
    expect(await screen.findByText("შეტყობინებები მუშაობს მხოლოდ ნამდვილ ტელეფონზე.")).toBeOnTheScreen();
    device.isDevice = true;
    // The server refusing the token.
    await fireEvent(toggle, "valueChange", true);
    expect(await screen.findByText("ვერ მოხერხდა. სცადე თავიდან.")).toBeOnTheScreen();
  });
});

describe("FavoritesScreen", () => {
  it("asks a signed-out user to sign in", async () => {
    serve({});
    await renderApp(<FavoritesScreen />);
    expect(await screen.findByRole("button", { name: "შესვლა" })).toBeOnTheScreen();
  });

  it("lists the user's favourites, says when there are none, and retries", async () => {
    serve({ "/api/v1/me": answer(signedIn({ favoriteIds: [7] })), "/api/v1/favorites": [new TypeError("offline"), answer({ listings: [listing], gelPerUsd: 2.7 })] });
    const view = await renderApp(<FavoritesScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    expect(await screen.findByText("$120,000")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "რჩეულებიდან ამოღება" }));
    await view.unmount();
    serve({ "/api/v1/me": answer(signedIn()), "/api/v1/favorites": answer({ listings: [], gelPerUsd: 2.7 }) });
    await renderApp(<FavoritesScreen />);
    expect(await screen.findByText("ჯერ არაფერი შეგინახავს. დააჭირე გულს განცხადებაზე.")).toBeOnTheScreen();
  });

  it("sends a heart pressed after signing out to sign-in", async () => {
    serve({ "/api/v1/me": answer(signedIn()), "/api/v1/favorites": answer({ listings: [listing], gelPerUsd: 2.7 }) });
    await renderApp(<FavoritesScreen />);
    expect(await screen.findByText("$120,000")).toBeOnTheScreen();
  });
});
