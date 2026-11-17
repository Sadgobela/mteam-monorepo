import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { answer, renderApp, serve, signedIn } from "@/test/render";
import MessagesScreen from "@/app/messages/index";
import ChatScreen, { CHAT_POLL_MS } from "@/app/messages/[id]";

const expoRouter = jest.requireMock("expo-router");
const { router } = expoRouter;

const conversation = (id: string, unread: boolean, otherName: string | null = "Giorgi") => ({
  id,
  listingId: 7,
  listingTitle: "Flat in Vake",
  otherName,
  lastBody: "ჯერ კიდევ იყიდება?",
  lastAt: "2026-11-15T10:00:00Z",
  unread,
});
const message = (id: string, mine: boolean, at: string, body = `message ${id}`) => ({ id, body, mine, at });
const chat = (messages: unknown[], otherName: string | null = "Giorgi") => answer({ id: "c1", listingId: 7, listingTitle: "Flat in Vake", otherName, messages });

describe("MessagesScreen", () => {
  it("asks a signed-out user to sign in", async () => {
    serve({});
    await renderApp(<MessagesScreen />);
    expect(await screen.findByRole("button", { name: "შესვლა" })).toBeOnTheScreen();
  });

  it("lists the chats with the unread marked, opens one, and keeps the list when a refresh fails", async () => {
    serve({
      "/api/v1/me": answer(signedIn()),
      "/api/v1/conversations": [answer({ conversations: [conversation("c1", true), conversation("c2", false, null)] }), new TypeError("offline")],
    });
    await renderApp(<MessagesScreen />);
    const unread = await screen.findByRole("button", { name: "ახალი: მიწერა: Giorgi. Flat in Vake" });
    expect(within(unread).getByTestId("unread-dot")).toBeOnTheScreen();
    expect(within(unread).getByText("15 ნოე")).toBeOnTheScreen();
    // Someone without a name is "a user", as on the site.
    const nameless = screen.getByRole("button", { name: "მიწერა: მომხმარებელი. Flat in Vake" });
    expect(within(nameless).queryByTestId("unread-dot")).not.toBeOnTheScreen();
    expect(within(nameless).getByText("მ")).toBeOnTheScreen();

    await fireEvent.press(unread);
    expect(router.push).toHaveBeenCalledWith("/messages/c1");

    await act(() => screen.getByTestId("chats").props.refreshControl.props.onRefresh());
    expect(screen.getByTestId("chats").props.refreshControl.props.refreshing).toBe(false);
    expect(screen.getByRole("button", { name: "ახალი: მიწერა: Giorgi. Flat in Vake" })).toBeOnTheScreen();
  });

  it("says when there are none, and retries after a failure", async () => {
    serve({ "/api/v1/me": answer(signedIn()), "/api/v1/conversations": [new TypeError("offline"), answer({ conversations: [] })] });
    await renderApp(<MessagesScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    expect(await screen.findByText(/შეტყობინებები ჯერ არ არის/)).toBeOnTheScreen();
  });
});

describe("ChatScreen", () => {
  beforeEach(() => expoRouter.useLocalSearchParams.mockReturnValue({ id: "c1" }));
  afterEach(() => expoRouter.useLocalSearchParams.mockReturnValue({}));

  it("asks a signed-out user to sign in, and goes back to the list when there is nothing behind", async () => {
    serve({});
    router.canGoBack.mockReturnValueOnce(false);
    await renderApp(<ChatScreen />);
    expect(await screen.findByRole("button", { name: "შესვლა" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "უკან" }));
    expect(router.replace).toHaveBeenCalledWith("/messages");
    expect(router.back).not.toHaveBeenCalled();
  });

  it("shows the person, the listing and the messages by day, and sends one", async () => {
    const sent = jest.fn((_body: unknown) => answer({ ok: true }));
    const fetchMock = serve({
      "/api/v1/me": answer(signedIn()),
      "GET /api/v1/conversations/c1": [
        chat([message("m1", false, "2026-11-15T10:05:00Z"), message("m2", true, "2026-11-15T10:07:00Z"), message("m3", false, "2026-11-16T08:00:00Z")]),
        chat([message("m1", false, "2026-11-15T10:05:00Z"), message("m2", true, "2026-11-15T10:07:00Z"), message("m3", false, "2026-11-16T08:00:00Z"), message("m4", true, "2026-11-16T09:00:00Z", "კი, მოვალ")]),
      ],
      "POST /api/v1/conversations/c1": (init) => sent(JSON.parse(String(init.body))),
    });
    await renderApp(<ChatScreen />);
    expect(await screen.findByRole("header", { name: "Giorgi" })).toBeOnTheScreen();
    expect(screen.getByText("G")).toBeOnTheScreen();
    // A line for each day, above its first message, in Tbilisi time.
    expect(screen.getByText("15 ნოემბერი")).toBeOnTheScreen();
    expect(screen.getByText("16 ნოემბერი")).toBeOnTheScreen();
    expect(screen.getByText("14:05")).toBeOnTheScreen();
    expect(screen.getAllByTestId("mine")).toHaveLength(1);
    expect(screen.getAllByTestId("theirs")).toHaveLength(2);

    await fireEvent.press(screen.getByRole("link", { name: "Flat in Vake" }));
    expect(router.push).toHaveBeenCalledWith("/listings/7");

    const send = screen.getByRole("button", { name: "გაგზავნა" });
    expect(send).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("შეტყობინება"), "  კი, მოვალ ");
    await fireEvent.press(screen.getByRole("button", { name: "გაგზავნა" }));
    expect(sent).toHaveBeenCalledWith({ body: "კი, მოვალ" });
    expect(await screen.findByText("კი, მოვალ")).toBeOnTheScreen();
    expect(screen.getByLabelText("შეტყობინება")).toHaveDisplayValue("");
    expect(screen.getAllByTestId("mine")).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([url, init]) => url.endsWith("/conversations/c1") && init.method === "GET")).toHaveLength(2);

    await fireEvent.press(screen.getByRole("button", { name: "უკან" }));
    expect(router.back).toHaveBeenCalled();
  });

  it("says when a message could not be sent, and keeps it to try again", async () => {
    serve({
      "/api/v1/me": answer(signedIn()),
      "GET /api/v1/conversations/c1": chat([message("m1", false, "2026-11-15T10:05:00Z")], null),
      "POST /api/v1/conversations/c1": [answer({ error: "failed" }, 422), answer({ ok: true })],
    });
    await renderApp(<ChatScreen />);
    // Someone without a name is "a user", as on the site.
    expect(await screen.findByRole("header", { name: "მომხმარებელი" })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText("შეტყობინება"), "გამარჯობა");
    await fireEvent.press(screen.getByRole("button", { name: "გაგზავნა" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ვერ გაიგზავნა. სცადე ცოტა ხანში.");
    expect(screen.getByLabelText("შეტყობინება")).toHaveDisplayValue("გამარჯობა");
    await fireEvent.press(screen.getByRole("button", { name: "გაგზავნა" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeOnTheScreen());
  });

  it("asks for new messages while open, keeps them when that fails, and stops when closed", async () => {
    const every = jest.spyOn(globalThis, "setInterval");
    const stop = jest.spyOn(globalThis, "clearInterval");
    const fetchMock = serve({
      "/api/v1/me": answer(signedIn()),
      "GET /api/v1/conversations/c1": [chat([message("m1", false, "2026-11-15T10:05:00Z")]), new TypeError("offline"), chat([message("m1", false, "2026-11-15T10:05:00Z"), message("m2", false, "2026-11-15T10:06:00Z")])],
    });
    const view = await renderApp(<ChatScreen />);
    expect(await screen.findByText("message m1")).toBeOnTheScreen();
    const poll = every.mock.calls.filter(([, delay]) => delay === CHAT_POLL_MS).at(-1)![0] as () => void;
    await act(async () => poll());
    expect(screen.getByText("message m1")).toBeOnTheScreen();
    await act(async () => poll());
    expect(await screen.findByText("message m2")).toBeOnTheScreen();
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/conversations/c1")).length).toBeGreaterThanOrEqual(3);
    await view.unmount();
    expect(stop).toHaveBeenCalled();
    every.mockRestore();
    stop.mockRestore();
  });

  it("offers a retry when the chat cannot be loaded", async () => {
    serve({ "/api/v1/me": answer(signedIn()), "GET /api/v1/conversations/c1": [answer({ error: "notFound" }, 404), chat([message("m1", true, "2026-11-15T10:05:00Z")])] });
    await renderApp(<ChatScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    expect(await screen.findByText("message m1")).toBeOnTheScreen();
  });
});
