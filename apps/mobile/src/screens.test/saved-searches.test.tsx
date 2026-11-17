import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { answer, renderApp, serve, signedIn } from "@/test/render";
import SavedSearchesScreen from "@/app/saved-searches";

const { router } = jest.requireMock("expo-router");
const search = (id: string, name: string, others = 0, newCount = 0) => ({ id, query: `city=${id}&deal=sale`, name, others, newCount });

describe("SavedSearchesScreen", () => {
  it("asks a signed-out user to sign in", async () => {
    serve({});
    await renderApp(<SavedSearchesScreen />);
    expect(await screen.findByRole("button", { name: "შესვლა" })).toBeOnTheScreen();
  });

  it("lists them with their other filters and new listings, and opens one on the search tab", async () => {
    const fetchMock = serve({
      "/api/v1/me": answer(signedIn()),
      "/api/v1/saved-searches": answer({ searches: [search("s1", "იყიდება ბინა თბილისში", 2, 3), search("s2", "ყველა განცხადება")] }),
      "POST /api/v1/saved-searches/s1/open": answer({ query: "city=თბილისი&deal=sale" }),
    });
    await renderApp(<SavedSearchesScreen />);
    const first = await screen.findByRole("button", { name: "ნახვა: იყიდება ბინა თბილისში +2" });
    expect(screen.getByText("ახალი: 3")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "ნახვა: ყველა განცხადება" })).toBeOnTheScreen();
    expect(new URL(fetchMock.mock.calls.find(([url]) => url.includes("/saved-searches"))[0]).searchParams.get("locale")).toBe("ka");

    await fireEvent.press(first);
    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith("/?city=თბილისი&deal=sale"));
    // Opened, its listings are no longer new.
    expect(screen.queryByText("ახალი: 3")).not.toBeOnTheScreen();
  });

  it("opens a search with its own filters when the server cannot count it as seen", async () => {
    serve({ "/api/v1/me": answer(signedIn()), "/api/v1/saved-searches": answer({ searches: [search("s1", "Batumi", 0, 1)] }), "POST /api/v1/saved-searches/s1/open": new TypeError("offline") });
    await renderApp(<SavedSearchesScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "ნახვა: Batumi" }));
    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith("/?city=s1&deal=sale"));
  });

  it("removes one at once, and brings the list back when the server keeps it", async () => {
    const fetchMock = serve({
      "/api/v1/me": answer(signedIn()),
      "/api/v1/saved-searches": answer({ searches: [search("s1", "Batumi"), search("s2", "Kutaisi")] }),
      "DELETE /api/v1/saved-searches/s1": answer({ ok: true }),
      "DELETE /api/v1/saved-searches/s2": new TypeError("offline"),
    });
    await renderApp(<SavedSearchesScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "წაშლა: Batumi" }));
    expect(screen.queryByText("Batumi")).not.toBeOnTheScreen();
    expect(fetchMock.mock.calls.some(([url, init]) => url.endsWith("/saved-searches/s1") && init.method === "DELETE")).toBe(true);

    await fireEvent.press(screen.getByRole("button", { name: "წაშლა: Kutaisi" }));
    // The server still has both, so both come back.
    expect(await screen.findByText("Kutaisi")).toBeOnTheScreen();
  });

  it("says when there are none, retries after a failure, and keeps the list when a refresh fails", async () => {
    serve({
      "/api/v1/me": answer(signedIn()),
      "/api/v1/saved-searches": [new TypeError("offline"), answer({ searches: [] }), answer({ searches: [search("s1", "Batumi")] }), new TypeError("offline")],
    });
    await renderApp(<SavedSearchesScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    expect(await screen.findByText(/ჯერ ძიება არ შეგინახავს/)).toBeOnTheScreen();

    await act(() => screen.getByTestId("saved").props.refreshControl.props.onRefresh());
    expect(screen.getByText("Batumi")).toBeOnTheScreen();
    await act(() => screen.getByTestId("saved").props.refreshControl.props.onRefresh());
    expect(screen.getByTestId("saved").props.refreshControl.props.refreshing).toBe(false);
    expect(screen.getByText("Batumi")).toBeOnTheScreen();
  });
});
