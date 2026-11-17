import { fireEvent, screen, waitFor } from "@testing-library/react-native";
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
    await fireEvent.press(screen.getByText("2"));
    await fireEvent.press(screen.getByRole("button", { name: "ძებნა" }));
    await waitFor(() => expect(query(fetchMock).get("deal")).toBe("rent"));
    expect(Object.fromEntries(query(fetchMock))).toEqual({ deal: "rent", type: "house", city: "თბილისი", priceMin: "500", priceMax: "900", rooms: "2", page: "1" });
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
