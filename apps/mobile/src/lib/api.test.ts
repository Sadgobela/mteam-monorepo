import { answer } from "@/test/render";
import { api, ApiError, setApiToken, toSearch } from "./api";

const fetchMock = jest.fn();
globalThis.fetch = fetchMock;

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1);
  return { url, ...init };
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(answer({ ok: true }));
  setApiToken(null);
});

describe("toSearch", () => {
  it("leaves out empty filters and repeats lists", () => {
    expect(toSearch({ deal: "sale", city: "", type: undefined, district: ["a", "b"] })).toBe("?deal=sale&district=a&district=b");
    expect(toSearch({})).toBe("");
  });
});

describe("api", () => {
  it("reads from the configured site, without a token when signed out", async () => {
    await api.search({ deal: "sale" });
    expect(lastCall()).toEqual({ url: "https://api.test/api/v1/listings?deal=sale", method: "GET", headers: { accept: "application/json" }, body: undefined });
  });

  it("sends the session token and JSON bodies", async () => {
    setApiToken("tok");
    await api.verifyCode("555123456", "123456");
    expect(lastCall()).toMatchObject({
      url: "https://api.test/api/v1/auth/verify",
      method: "POST",
      headers: { authorization: "Bearer tok", "content-type": "application/json" },
      body: JSON.stringify({ phone: "555123456", code: "123456" }),
    });
  });

  it.each([
    ["listing", () => api.listing("7 8"), "/api/v1/listings/7%208", "GET"],
    ["phone", () => api.phone(7), "/api/listings/7/phone", "GET"],
    ["requestCode", () => api.requestCode("555"), "/api/v1/auth/code", "POST"],
    ["logout", () => api.logout(), "/api/v1/auth/logout", "POST"],
    ["me", () => api.me(), "/api/v1/me", "GET"],
    ["onboard", () => api.onboard("Nino", "OWNER"), "/api/v1/onboarding", "POST"],
    ["favorites", () => api.favorites(), "/api/v1/favorites", "GET"],
    ["setFavorite", () => api.setFavorite(7, true), "/api/v1/favorites/7", "PUT"],
    ["myListings", () => api.myListings(), "/api/v1/my-listings", "GET"],
    ["savePush", () => api.savePush("tok", "ios", "en"), "/api/v1/push", "POST"],
    ["deletePush", () => api.deletePush("tok"), "/api/v1/push", "DELETE"],
  ])("%s calls its endpoint", async (_name, run, path, method) => {
    await run();
    expect(lastCall()).toMatchObject({ url: `https://api.test${path}`, method });
  });

  it("uploads a photo as a file in a form, naming it when the picker did not", async () => {
    // React Native's FormData keeps the file description as given; Node's would turn it into text.
    const append = jest.spyOn(FormData.prototype, "append").mockImplementation(() => undefined);
    await api.uploadPhoto({ uri: "file:///a.png", mimeType: "image/png", fileName: "a.png" });
    expect(lastCall().url).toBe("https://api.test/api/listings/photos");
    expect(lastCall().body).toBeInstanceOf(FormData);
    expect(append).toHaveBeenLastCalledWith("photo", { uri: "file:///a.png", type: "image/png", name: "a.png" });
    await api.uploadPhoto({ uri: "file:///b" });
    expect(append).toHaveBeenLastCalledWith("photo", { uri: "file:///b", type: "image/jpeg", name: "photo.jpeg" });
    append.mockRestore();
  });

  it("submits a listing as plain form fields with its photos", async () => {
    await api.submitListing({ title: "Flat" }, ["https://cdn/a.jpg", "https://cdn/b.jpg"]);
    expect(lastCall()).toMatchObject({
      url: "https://api.test/api/listings",
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "title=Flat&intent=submit&photos=https%3A%2F%2Fcdn%2Fa.jpg&photos=https%3A%2F%2Fcdn%2Fb.jpg",
    });
  });

  it("turns an error answer into its code, and an unreadable one into failed", async () => {
    fetchMock.mockResolvedValueOnce(answer({ error: "tooSoon" }, 429));
    await expect(api.requestCode("555")).rejects.toEqual(new ApiError("tooSoon", 429));
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => Promise.reject(new Error("html")) });
    await expect(api.me()).rejects.toMatchObject({ code: "failed", status: 500 });
  });

  it("says network when the server cannot be reached", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await expect(api.me()).rejects.toMatchObject({ code: "network", status: 0 });
  });
});
