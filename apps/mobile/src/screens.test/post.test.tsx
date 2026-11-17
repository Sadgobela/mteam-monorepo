import { Alert } from "react-native";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { cities, cityDistricts, getDictionary, popularCities } from "@mteam/shared";
import { answer, renderApp, serve, signedIn } from "@/test/render";
import PostScreen from "@/app/(tabs)/post";
import EditListingScreen from "@/app/edit/[id]";

const { router } = jest.requireMock("expo-router");
const picker = jest.requireMock("expo-image-picker");
const t = getDictionary("ka");
const district = cityDistricts("თბილისი")[0];

const fill = async () => {
  await fireEvent.press(screen.getAllByText("თბილისი")[0]);
  await fireEvent.press(screen.getAllByText(district)[0]);
  await fireEvent.changeText(screen.getByLabelText(t.post.fields.address), "Chavchavadze 1");
  await fireEvent.changeText(screen.getByLabelText(t.post.fields.title), "Sunny flat");
  await fireEvent.changeText(screen.getByLabelText(t.post.fields.description), "Near the park");
  await fireEvent.changeText(screen.getByLabelText(t.post.fields.area), "80");
  await fireEvent.changeText(screen.getByLabelText(t.post.fields.rooms), "3");
  await fireEvent.changeText(screen.getByLabelText(t.post.fields.price), "120000");
};
const addPhotos = async (...uris: string[]) => {
  picker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: uris.map((uri) => ({ uri })) });
  await fireEvent.press(screen.getByRole("button", { name: "+ ფოტო" }));
  await screen.findByLabelText(`${t.post.fields.photoRemove} ${uris.length}`);
};

describe("PostScreen", () => {
  it("asks a signed-out user to sign in, and a new account to finish onboarding", async () => {
    serve({});
    const view = await renderApp(<PostScreen />);
    expect(await screen.findByRole("button", { name: "შესვლა" })).toBeOnTheScreen();
    await view.unmount();
    serve({ "/api/v1/me": answer(signedIn({ onboarded: false })) });
    await renderApp(<PostScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: t.profile.start }));
    expect(router.push).toHaveBeenCalledWith("/onboarding");
  });

  it("checks the fields and the photos, uploads each photo and sends the listing", async () => {
    const fetchMock = serve({
      "/api/v1/me": answer(signedIn()),
      "/api/listings/photos": [answer({ url: "https://cdn/1.jpg" }), answer({ url: "https://cdn/2.jpg" })],
      "/api/listings": answer({ id: 9, status: "PENDING" }),
    });
    await renderApp(<PostScreen />);
    const submit = await screen.findByRole("button", { name: t.post.submit });
    await fireEvent.press(submit);
    expect(screen.getByText(t.post.errors.invalid)).toBeOnTheScreen();

    await fill();
    await fireEvent.press(submit);
    expect(screen.getByText(t.post.errors.photos)).toBeOnTheScreen();

    await addPhotos("file:///1.jpg", "file:///2.jpg", "file:///3.jpg");
    await fireEvent.press(screen.getByLabelText(`${t.post.fields.photoRemove} 3`));
    await fireEvent.press(submit);
    expect(await screen.findByText(t.post.sent)).toBeOnTheScreen();
    const sent = new URLSearchParams(fetchMock.mock.calls.at(-1)[1].body);
    expect(Object.fromEntries(sent)).toMatchObject({ deal: "sale", type: "apartment", city: "თბილისი", district, title: "Sunny flat", price: "120000", currency: "USD", intent: "submit" });
    expect(sent.getAll("photos")).toEqual(["https://cdn/1.jpg", "https://cdn/2.jpg"]);

    await fireEvent.press(screen.getByRole("button", { name: t.post.toMyListings }));
    expect(router.push).toHaveBeenCalledWith("/my-listings");
    await fireEvent.press(screen.getByRole("button", { name: t.post.another }));
    expect(screen.getByLabelText(t.post.fields.title)).toHaveDisplayValue("");
  });

  it("explains a refused photo access, a cancelled pick and the server's refusals", async () => {
    serve({
      "/api/v1/me": answer(signedIn()),
      "/api/listings/photos": [answer({ error: "tooMany" }, 429), answer({ url: "https://cdn/1.jpg" })],
      "/api/listings": answer({ error: "save" }, 500),
    });
    await renderApp(<PostScreen />);
    await screen.findByRole("button", { name: t.post.submit });
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ granted: false });
    await fireEvent.press(screen.getByRole("button", { name: "+ ფოტო" }));
    expect(await screen.findByText("ფოტოების დასამატებლად დაუშვი წვდომა გალერეაზე.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "+ ფოტო" }));
    await waitFor(() => expect(picker.launchImageLibraryAsync).toHaveBeenCalled());

    await fill();
    await addPhotos("file:///1.jpg");
    await fireEvent.press(screen.getByRole("button", { name: t.post.submit }));
    expect(await screen.findByText(t.post.errors.tooMany)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: t.post.submit }));
    expect(await screen.findByText(t.post.errors.save)).toBeOnTheScreen();
  });

  it("clears the district when the city changes, and stops offering photos at the limit", async () => {
    serve({ "/api/v1/me": answer(signedIn()) });
    await renderApp(<PostScreen />);
    await screen.findByRole("button", { name: t.post.submit });
    await fireEvent.press(screen.getAllByText("თბილისი")[0]);
    await fireEvent.press(screen.getAllByText(district)[0]);
    await fireEvent.press(screen.getByText("ბათუმი"));
    // Pressing the chosen deal again clears it, which the checks then refuse.
    await fireEvent.press(screen.getByText("იყიდება"));
    await fireEvent.press(screen.getByRole("button", { name: t.post.submit }));
    expect(screen.getByText(t.post.errors.invalid)).toBeOnTheScreen();
    expect(screen.queryByText(district)).not.toBeOnTheScreen();
    await addPhotos(...Array.from({ length: 17 }, (_, index) => `file:///${index}.jpg`).slice(0, 16));
    expect(screen.queryByRole("button", { name: "+ ფოტო" })).not.toBeOnTheScreen();
  });
});

describe("EditListingScreen", () => {
  const { useLocalSearchParams } = jest.requireMock("expo-router");
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  const fields = { deal: "sale", type: "apartment", city: "თბილისი", district, street: "ჭავჭავაძის გამზირი", address: "Chavchavadze 1", title: "Sunny flat", description: "Near the park", price: "120000", currency: "USD", area: "80", rooms: "3", floor: "", floors: "", features: "balcony|parking", ceiling: "" };
  const editable = (status: string, extra: object = {}) => answer({ id: 7, status, fields: { ...fields, ...extra }, images: ["https://cdn/old-1.jpg", "https://cdn/old-2.jpg"] });
  const sentFields = (fetchMock: jest.Mock) => new URLSearchParams(fetchMock.mock.calls.find(([url, init]) => url.endsWith("/api/listings") && init.method === "POST")[1].body);

  beforeEach(() => useLocalSearchParams.mockReturnValue({ id: "7" }));
  afterEach(() => useLocalSearchParams.mockReturnValue({}));

  it("asks a signed-out user to sign in, and a new account to finish onboarding", async () => {
    serve({});
    const view = await renderApp(<EditListingScreen />);
    expect(await screen.findByRole("button", { name: "შესვლა" })).toBeOnTheScreen();
    await view.unmount();
    serve({ "/api/v1/me": answer(signedIn({ onboarded: false })) });
    await renderApp(<EditListingScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: t.profile.start }));
    expect(router.push).toHaveBeenCalledWith("/onboarding");
  });

  it("fills the form with the listing, sends back every field and the photos it keeps, and goes back", async () => {
    const fetchMock = serve({
      "/api/v1/me": answer(signedIn()),
      "GET /api/v1/my-listings/7": [new TypeError("offline"), editable("ACTIVE")],
      "/api/listings/photos": answer({ url: "https://cdn/new.jpg" }),
      "/api/listings": answer({ id: 7, status: "ACTIVE" }),
    });
    await renderApp(<EditListingScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    expect(await screen.findByLabelText(t.post.fields.title)).toHaveDisplayValue("Sunny flat");
    expect(screen.getByLabelText(t.post.fields.price)).toHaveDisplayValue("120000");
    await fireEvent.press(screen.getByLabelText(`${t.post.fields.photoRemove} 1`));
    await addPhotos("file:///new.jpg");
    await fireEvent.changeText(screen.getByLabelText(t.post.fields.price), "115000");
    await fireEvent.press(screen.getByRole("button", { name: t.post.save }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(t.post.savedLive));
    expect(router.back).toHaveBeenCalled();
    const sent = sentFields(fetchMock);
    // The details the app does not show are kept, as they came.
    expect(Object.fromEntries(sent)).toMatchObject({ id: "7", price: "115000", street: "ჭავჭავაძის გამზირი", features: "balcony|parking", intent: "submit" });
    expect(sent.has("floor")).toBe(false);
    expect(sent.getAll("photos")).toEqual(["https://cdn/old-2.jpg", "https://cdn/new.jpg"]);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/api/listings/photos"))).toHaveLength(1);
  });

  it("clears the street when the district changes, and says an edit is back in review", async () => {
    const fetchMock = serve({ "/api/v1/me": answer(signedIn()), "GET /api/v1/my-listings/7": editable("PENDING"), "/api/listings": answer({ id: 7, status: "PENDING" }) });
    await renderApp(<EditListingScreen />);
    await screen.findByLabelText(t.post.fields.title);
    await fireEvent.press(screen.getAllByText(cityDistricts("თბილისი")[1])[0]);
    await fireEvent.press(screen.getByRole("button", { name: t.post.save }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(t.post.savedReview));
    expect(sentFields(fetchMock).has("street")).toBe(false);
  });

  it("finishes a draft from a city off the short list, and opens my listings when there is nothing behind", async () => {
    const town = cities.find((city) => !popularCities.includes(city))!;
    serve({ "/api/v1/me": answer(signedIn()), "GET /api/v1/my-listings/7": editable("DRAFT", { city: town, district: cityDistricts(town)[0], street: "" }), "/api/listings": answer({ id: 7, status: "PENDING" }) });
    router.canGoBack.mockReturnValueOnce(false);
    await renderApp(<EditListingScreen />);
    expect(await screen.findByRole("button", { name: town })).toBeSelected();
    await fireEvent.press(screen.getByRole("button", { name: t.post.submit }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(t.post.sent));
    expect(router.replace).toHaveBeenCalledWith("/my-listings");
  });
});
