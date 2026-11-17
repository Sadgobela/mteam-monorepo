import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { answer, listing, renderApp, serve } from "@/test/render";
import SearchScreen from "@/app/(tabs)/index";

const page = (listings: unknown[], total: number, pageNumber = 1) => answer({ listings, total, page: pageNumber, pageSize: 24, gelPerUsd: 2.7 });
const query = (fetchMock: jest.Mock, call = -1) => new URL(fetchMock.mock.calls.at(call)[0]).searchParams;

describe("SearchScreen", () => {
  it("loads sales first, then searches with the chosen filters", async () => {
    const fetchMock = serve({ "/api/v1/listings": page([listing], 1) });
    await renderApp(<SearchScreen />);
    expect(await screen.findByText("მოიძებნა 1 განცხადება")).toBeOnTheScreen();
    expect(query(fetchMock).toString()).toBe("deal=sale&page=1");

    await fireEvent.press(screen.getByText("ქირავდება"));
    await fireEvent.press(screen.getByText("სახლი"));
    await fireEvent.press(screen.getAllByText("თბილისი")[0]);
    // Price and rooms are folded away until asked for.
    expect(screen.queryByLabelText("ფასი, $ დან")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "ფილტრები" }));
    await fireEvent.changeText(screen.getByLabelText("ფასი, $ დან"), "500");
    await fireEvent.changeText(screen.getByLabelText("ფასი, $ მდე"), "900");
    // The rooms chip, above the cards (a card's photo count can read 2 as well).
    await fireEvent.press(screen.getAllByText("2")[0]);
    await fireEvent.press(screen.getByRole("button", { name: "ძებნა" }));
    await waitFor(() => expect(query(fetchMock).get("deal")).toBe("rent"));
    expect(Object.fromEntries(query(fetchMock))).toEqual({ deal: "rent", type: "house", city: "თბილისი", priceMin: "500", priceMax: "900", rooms: "2", page: "1" });
  });

  it("sorts the results at once, and back to newest first", async () => {
    const fetchMock = serve({ "/api/v1/listings": page([listing], 1) });
    await renderApp(<SearchScreen />);
    await fireEvent.press(await screen.findByText("ფასი ↑"));
    await waitFor(() => expect(query(fetchMock).get("sort")).toBe("asc"));
    await fireEvent.press(await screen.findByText("ფასი ↑"));
    await waitFor(() => expect(query(fetchMock).get("sort")).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("opens with a saved search's filters from its address, and starts over for another", async () => {
    const { useLocalSearchParams } = jest.requireMock("expo-router");
    useLocalSearchParams.mockReturnValue({ deal: "rent", city: "ბათუმი" });
    const fetchMock = serve({ "/api/v1/listings": page([listing], 1) });
    const view = await renderApp(<SearchScreen />);
    await waitFor(() => expect(query(fetchMock).toString()).toBe("deal=rent&city=%E1%83%91%E1%83%90%E1%83%97%E1%83%A3%E1%83%9B%E1%83%98&page=1"));
    expect(screen.getByRole("button", { name: "ქირავდება" })).toBeSelected();
    useLocalSearchParams.mockReturnValue({ type: "house" });
    await view.rerender(<SearchScreen />);
    await waitFor(() => expect(query(fetchMock).toString()).toBe("type=house&page=1"));
    // No deal in the address: the switch shows sales.
    expect(screen.getByRole("button", { name: "იყიდება" })).toBeSelected();
    useLocalSearchParams.mockReturnValue({});
  });

  it("keeps the latest search when an older one answers last", async () => {
    let late!: (value: Response) => void;
    serve({ "/api/v1/listings": [() => new Promise<Response>((resolve) => (late = resolve)), page([listing], 1)] });
    await renderApp(<SearchScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "ძებნა" }));
    expect(await screen.findByText("მოიძებნა 1 განცხადება")).toBeOnTheScreen();
    await act(async () => late(page([listing, { ...listing, id: 8 }], 2)));
    expect(screen.getByText("მოიძებნა 1 განცხადება")).toBeOnTheScreen();
  });

  it("adds the next page under the first", async () => {
    const fetchMock = serve({ "/api/v1/listings": [page([listing], 2), page([{ ...listing, id: 8 }], 2, 2)] });
    await renderApp(<SearchScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "მეტის ნახვა" }));
    await waitFor(() => expect(screen.getAllByText("$120,000")).toHaveLength(2));
    expect(query(fetchMock).get("page")).toBe("2");
    expect(screen.queryByRole("button", { name: "მეტის ნახვა" })).not.toBeOnTheScreen();
  });

  it("keeps the first page when the next one fails", async () => {
    serve({ "/api/v1/listings": [page([listing], 2), new TypeError("offline")] });
    await renderApp(<SearchScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "მეტის ნახვა" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "მეტის ნახვა" })).toBeEnabled());
    expect(screen.getAllByText("$120,000")).toHaveLength(1);
  });

  it("says when nothing matches, and offers a retry when loading fails", async () => {
    serve({ "/api/v1/listings": [new TypeError("offline"), page([], 0)] });
    await renderApp(<SearchScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    expect(await screen.findByText("ამ ფილტრებით განცხადება ვერ მოიძებნა.")).toBeOnTheScreen();
  });

  it("sends a signed-out heart to sign-in", async () => {
    const { router } = jest.requireMock("expo-router");
    serve({ "/api/v1/listings": page([listing], 1) });
    await renderApp(<SearchScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "რჩეულებში დამატება" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/login"));
  });
});
