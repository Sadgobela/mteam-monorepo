import { Text } from "react-native";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { useSession } from "@/lib/session";
import { answer, renderApp, serve, signedIn } from "@/test/render";
import NotificationsScreen from "@/app/(tabs)/notifications";

const { router } = jest.requireMock("expo-router");
const notice = (id: string, read: boolean, title = "Flat in Vake") => ({ id, read, at: "2026-11-15T10:00:00Z", title, body: "შენი განცხადება გამოქვეყნდა" });
const page = (notifications: unknown[], unread: number) => answer({ notifications, unread });
/** The menu's badge number. */
const Badge = () => <Text testID="badge">{useSession().unread}</Text>;

describe("NotificationsScreen", () => {
  it("asks a signed-out user to sign in", async () => {
    serve({});
    await renderApp(<NotificationsScreen />);
    expect(await screen.findByRole("button", { name: "შესვლა" })).toBeOnTheScreen();
  });

  it("lists them newest first with the unread marked, and opens one where it leads", async () => {
    const fetchMock = serve({
      "/api/v1/me": answer(signedIn({ unread: 2 })),
      "/api/v1/notifications": page([notice("n1", false), notice("n2", true, "Old flat")], 1),
      "POST /api/v1/notifications/n1": answer({ path: "/ka/listings/7" }),
    });
    await renderApp(<NotificationsScreen />);
    const unread = await screen.findByRole("button", { name: "ახალი: Flat in Vake. შენი განცხადება გამოქვეყნდა" });
    expect(within(unread).getByTestId("unread-dot")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Old flat. შენი განცხადება გამოქვეყნდა" })).toBeOnTheScreen();
    expect(new URL(fetchMock.mock.calls.find(([url]) => url.includes("/notifications"))[0]).searchParams.get("locale")).toBe("ka");

    await fireEvent.press(unread);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/listings/7"));
    expect(screen.queryByTestId("unread-dot")).not.toBeOnTheScreen();
    // Opening one already read changes no count.
    await fireEvent.press(screen.getByRole("button", { name: "Old flat. შენი განცხადება გამოქვეყნდა" }));
  });

  it("counts the badge down from the server's number, not from the newest ones listed", async () => {
    serve({
      "/api/v1/me": answer(signedIn({ unread: 60 })),
      "/api/v1/notifications": page([notice("n1", false)], 60),
      "POST /api/v1/notifications/n1": answer({ path: "/ka/listings/7" }),
    });
    await renderApp(
      <>
        <NotificationsScreen />
        <Badge />
      </>,
    );
    await fireEvent.press(await screen.findByRole("button", { name: /^ახალი: Flat in Vake/ }));
    await waitFor(() => expect(screen.getByTestId("badge")).toHaveTextContent("59"));
  });

  it("marks them all read, and keeps the list when a refresh fails", async () => {
    const fetchMock = serve({
      "/api/v1/me": answer(signedIn()),
      "/api/v1/notifications": [page([notice("n1", false), notice("n2", false)], 2), new TypeError("offline")],
      "POST /api/v1/notifications": answer({ ok: true }),
    });
    await renderApp(<NotificationsScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "ყველას წაკითხულად მონიშვნა" }));
    expect(screen.queryByTestId("unread-dot")).not.toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "ყველას წაკითხულად მონიშვნა" })).not.toBeOnTheScreen();
    expect(fetchMock.mock.calls.some(([url, init]) => url.endsWith("/api/v1/notifications") && init.method === "POST")).toBe(true);

    // A pull: the list's refresh control asks again.
    await act(() => screen.getByTestId("notifications").props.refreshControl.props.onRefresh());
    expect(screen.getByTestId("notifications").props.refreshControl.props.refreshing).toBe(false);
    expect(screen.getAllByText("Flat in Vake")).toHaveLength(2);
  });

  it("marks them all read here even when the server cannot be reached", async () => {
    serve({ "/api/v1/me": answer(signedIn()), "/api/v1/notifications": page([notice("n1", false)], 1), "POST /api/v1/notifications": new TypeError("offline") });
    await renderApp(<NotificationsScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "ყველას წაკითხულად მონიშვნა" }));
    await waitFor(() => expect(screen.queryByTestId("unread-dot")).not.toBeOnTheScreen());
  });

  it("says when there is nothing, retries after a failure, and stays put when opening fails offline", async () => {
    serve({
      "/api/v1/me": answer(signedIn()),
      "/api/v1/notifications": [new TypeError("offline"), page([], 0), page([notice("n1", false)], 1)],
      "POST /api/v1/notifications/n1": new TypeError("offline"),
    });
    const view = await renderApp(<NotificationsScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    expect(await screen.findByText(/ჯერ არაფერია/)).toBeOnTheScreen();
    await view.unmount();
    await renderApp(<NotificationsScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: /^ახალი: Flat in Vake/ }));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByTestId("unread-dot")).not.toBeOnTheScreen();
  });
});
