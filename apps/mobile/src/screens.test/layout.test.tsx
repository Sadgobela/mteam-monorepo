import { AppState, Linking } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { NotificationResponse } from "expo-notifications";
import { answer, serve, signedIn } from "@/test/render";
import TabsLayout from "@/app/(tabs)/_layout";
import RootLayout, { openNotification } from "@/app/_layout";

const expoRouter = jest.requireMock("expo-router");
const { router } = expoRouter;
const notifications = jest.requireMock("expo-notifications");
const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
const tapped = (data: unknown, identifier?: string) => ({ notification: { request: { identifier, content: { data } } } }) as unknown as NotificationResponse;

describe("openNotification", () => {
  it("opens the app's screen for a listing, the site for anything else, and nothing without an address", () => {
    openNotification(tapped({ url: "/ka/listings/7" }));
    expect(router.push).toHaveBeenCalledWith("/listings/7");
    openNotification(tapped({ url: "/ka/brokers" }));
    expect(openURL).toHaveBeenCalledWith("https://api.test/ka/brokers");
    openNotification(tapped(undefined));
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("follows only paths on the site, so a push cannot lead to another site", () => {
    openNotification(tapped({ url: ".evil.test/x" }, "push-evil-1"));
    openNotification(tapped({ url: "@evil.test" }, "push-evil-2"));
    expect(openURL).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("switches to a tab from a screen on top of the tabs, instead of stacking the tabs again", () => {
    router.canDismiss.mockReturnValueOnce(true);
    openNotification(tapped({ url: "/ka?deal=rent" }, "push-search"));
    expect(router.dismissAll).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith("/?deal=rent");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens each notification once, and marks it read by its id", async () => {
    const fetchMock = serve({ "POST /api/v1/notifications/n1": answer({ path: "/ka/listings/7" }), "POST /api/v1/notifications/n2": answer({ error: "notFound" }, 404) });
    const then = jest.fn();
    openNotification(tapped({ url: "/ka/listings/7", tag: "n1" }, "push-1"), then);
    openNotification(tapped({ url: "/ka/listings/7", tag: "n1" }, "push-1"), then);
    expect(router.push).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(then).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    openNotification(tapped({ url: "/ka/my-listings", tag: "n2" }, "push-2"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(router.push).toHaveBeenLastCalledWith("/my-listings");
  });
});

describe("RootLayout", () => {
  it("opens the tap that started the app, listens for taps and arrivals while mounted, and shows the menu", async () => {
    const fetchMock = serve({ "/api/v1/me": answer(signedIn({ unread: 1 })), "POST /api/v1/notifications/n3": answer({ path: "/ka/account/notifications" }) });
    const removeTap = jest.fn();
    const removeArrival = jest.fn();
    notifications.addNotificationResponseReceivedListener.mockReturnValueOnce({ remove: removeTap });
    notifications.addNotificationReceivedListener.mockReturnValueOnce({ remove: removeArrival });
    notifications.getLastNotificationResponseAsync.mockResolvedValueOnce(tapped({ url: "/ka/account/notifications", tag: "n3" }, "push-3"));
    const view = await render(<RootLayout />);
    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith("/notifications"));
    // Marked read as the signed-in user: the tap waits until the stored session is back.
    const marked = fetchMock.mock.calls.find(([url]) => url.endsWith("/api/v1/notifications/n3"));
    expect(marked[1].headers.authorization).toBe("Bearer tok");
    expect(await screen.findByLabelText("მთავარი მენიუ")).toBeOnTheScreen();
    // The splash cover fades away once the session is known.
    await waitFor(() => expect(screen.queryByTestId("boot")).not.toBeOnTheScreen());

    // A tap while open goes through the same path, and an arrival refreshes the unread count.
    const onTap = notifications.addNotificationResponseReceivedListener.mock.calls[0][0];
    onTap(tapped({ url: "/ka/listings/9" }, "push-4"));
    expect(router.push).toHaveBeenLastCalledWith("/listings/9");
    const onArrival = notifications.addNotificationReceivedListener.mock.calls[0][0];
    await onArrival();
    await view.unmount();
    expect(removeTap).toHaveBeenCalled();
    expect(removeArrival).toHaveBeenCalled();
  });

  it("reads the badge again when the app comes back to the front, and stops listening when gone", async () => {
    const fetchMock = serve({ "/api/v1/me": answer(signedIn({ unread: 1 })) });
    // React Native's test setup already stands AppState in with a mock; this only watches it.
    const listen = jest.spyOn(AppState, "addEventListener");
    const view = await render(<RootLayout />);
    await waitFor(() => expect(listen).toHaveBeenCalled());
    const changed = listen.mock.calls[0][1];
    const profiles = () => fetchMock.mock.calls.filter(([url]) => url.endsWith("/api/v1/me")).length;
    const before = profiles();
    changed("background");
    expect(profiles()).toBe(before);
    changed("active");
    await waitFor(() => expect(profiles()).toBe(before + 1));
    await view.unmount();
    expect(listen.mock.results[0].value.remove).toHaveBeenCalled();
  });

  it("starts without a waiting notification", async () => {
    serve({});
    await render(<RootLayout />);
    await waitFor(() => expect(notifications.getLastNotificationResponseAsync).toHaveBeenCalled());
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("TabsLayout", () => {
  it("hides the tabs' own bar for the glass menu, and puts the logo and the chats over search", async () => {
    const Tabs = expoRouter.Tabs;
    const screens = jest.fn(() => null);
    const navigator = jest.fn(({ children }) => children);
    expoRouter.Tabs = Object.assign(navigator, { Screen: screens });
    await render(<TabsLayout />);
    expoRouter.Tabs = Tabs;
    expect(navigator.mock.calls[0][0].tabBar()).toBeNull();
    const names = (screens.mock.calls as unknown as [{ name: string }][]).map(([props]) => props.name);
    expect(names).toEqual(["index", "favorites", "post", "notifications", "account"]);
    const [[search]] = screens.mock.calls as unknown as [[{ options: { headerTitle: () => React.ReactElement; headerRight: () => React.ReactElement } }]];
    await render(search.options.headerTitle());
    expect(screen.getByLabelText("MTeam")).toBeOnTheScreen();
    // The chats are a tap away from search.
    await render(search.options.headerRight());
    await fireEvent.press(screen.getByRole("button", { name: "მიმოწერა" }));
    expect(router.push).toHaveBeenCalledWith("/messages");
  });
});
