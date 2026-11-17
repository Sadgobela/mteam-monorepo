import { Alert, type AlertButton } from "react-native";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { getDictionary } from "@mteam/shared";
import { answer, renderApp, serve, signedIn } from "@/test/render";
import ProfileScreen from "@/app/profile";
import SettingsScreen from "@/app/settings";

const { router } = jest.requireMock("expo-router");
const picker = jest.requireMock("expo-image-picker");
const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
const t = getDictionary("ka");

const profile = (extra: object = {}) => answer({ name: "Nino", avatarUrl: null, intent: "OWNER", createdAt: "2026-11-01T08:00:00Z", ...extra });
const preferences = { notifyMessages: true, notifySavedSearches: true, notifyPriceDrops: false, notifyListingUpdates: true, notifyPush: true, hidePhoneDefault: false };

describe("ProfileScreen", () => {
  it("asks a signed-out user to sign in", async () => {
    serve({});
    await renderApp(<ProfileScreen />);
    expect(await screen.findByRole("button", { name: "შესვლა" })).toBeOnTheScreen();
  });

  it("shows the name, the date joined and what brings them here, and saves a change", async () => {
    const fetchMock = serve({
      "/api/v1/me": answer(signedIn()),
      "GET /api/v1/profile": [new TypeError("offline"), profile()],
      "PUT /api/v1/profile": [answer({ ok: true }), answer({ error: "invalid" }, 422), new TypeError("offline")],
    });
    await renderApp(<ProfileScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    expect(await screen.findByLabelText(t.profile.name)).toHaveDisplayValue("Nino");
    expect(screen.getByText("MTeam-ზე რეგისტრაცია: 1 ნოემბერი, 2026")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: t.profile.intents.OWNER })).toBeSelected();
    // The chosen answer pressed again stays chosen.
    await fireEvent.press(screen.getByRole("button", { name: t.profile.intents.OWNER }));
    expect(screen.getByRole("button", { name: t.profile.intents.OWNER })).toBeSelected();

    await fireEvent.changeText(screen.getByLabelText(t.profile.name), " Nino Beridze ");
    await fireEvent.press(screen.getByRole("button", { name: t.profile.intents.BROKER }));
    await fireEvent.press(screen.getByRole("button", { name: t.profile.save }));
    expect(await screen.findByText(t.profile.saved)).toBeOnTheScreen();
    const put = fetchMock.mock.calls.find(([, init]) => init.method === "PUT");
    expect(JSON.parse(put[1].body)).toEqual({ name: "Nino Beridze", intent: "BROKER" });
    // The account's greeting is read again.
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/api/v1/me")).length).toBeGreaterThan(1);

    await fireEvent.press(screen.getByRole("button", { name: t.profile.save }));
    expect(await screen.findByText(t.profile.invalid)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: t.profile.save }));
    expect(await screen.findByText(t.feedback.failed)).toBeOnTheScreen();
  });

  it("asks what brings a user without an answer here before saving", async () => {
    const fetchMock = serve({ "/api/v1/me": answer(signedIn()), "GET /api/v1/profile": profile({ name: null, intent: null }) });
    await renderApp(<ProfileScreen />);
    expect(await screen.findByLabelText(t.profile.name)).toHaveDisplayValue("");
    expect(screen.getByText("?", { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: t.profile.save }));
    expect(screen.getByText(t.profile.invalid)).toBeOnTheScreen();
    expect(fetchMock.mock.calls.some(([, init]) => init.method === "PUT")).toBe(false);
  });

  it("changes the photo, and explains a refused access and the server's refusals", async () => {
    serve({
      "/api/v1/me": answer(signedIn()),
      "GET /api/v1/profile": profile(),
      "POST /api/v1/profile/avatar": [answer({ avatarUrl: "https://cdn.test/avatars/me.webp" }), answer({ error: "tooMany" }, 429), answer({ error: "invalid" }, 422)],
    });
    await renderApp(<ProfileScreen />);
    const photo = await screen.findByRole("button", { name: t.profile.photo });
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ granted: false });
    await fireEvent.press(photo);
    expect(await screen.findByText(t.mobile.photoAccess)).toBeOnTheScreen();
    // A cancelled pick changes nothing.
    await fireEvent.press(photo);
    await waitFor(() => expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, aspect: [1, 1] })));
    expect(screen.queryByText(t.mobile.photoAccess)).not.toBeOnTheScreen();

    const pick = () => picker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: "file:///me.jpg" }] });
    pick();
    await fireEvent.press(photo);
    const change = await screen.findByRole("button", { name: t.profile.photoChange });
    pick();
    await fireEvent.press(change);
    expect(await screen.findByText(t.profile.photoTooMany)).toBeOnTheScreen();
    pick();
    await fireEvent.press(change);
    expect(await screen.findByText(t.profile.photoFailed)).toBeOnTheScreen();
  });
});

describe("SettingsScreen", () => {
  it("asks a signed-out user to sign in", async () => {
    serve({});
    await renderApp(<SettingsScreen />);
    expect(await screen.findByRole("button", { name: "შესვლა" })).toBeOnTheScreen();
  });

  it("flips a switch at once, and back when it cannot be saved", async () => {
    const fetchMock = serve({
      "/api/v1/me": answer(signedIn()),
      "GET /api/v1/settings": [new TypeError("offline"), answer({ preferences, canDelete: false })],
      "PUT /api/v1/settings": [answer({ ok: true }), answer({ error: "invalid" }, 400)],
    });
    await renderApp(<SettingsScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    const priceDrops = await screen.findByLabelText(t.settings.notifyPriceDrops);
    expect(priceDrops).toHaveProp("value", false);
    expect(screen.getByLabelText(t.push.allDevices)).toHaveProp("value", true);
    expect(screen.getByText(t.push.allDevicesHint)).toBeOnTheScreen();
    await fireEvent(priceDrops, "valueChange", true);
    expect(screen.getByLabelText(t.settings.notifyPriceDrops)).toHaveProp("value", true);
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init.method === "PUT")).toBe(true));
    expect(JSON.parse(fetchMock.mock.calls.find(([, init]) => init.method === "PUT")[1].body)).toEqual({ key: "notifyPriceDrops", value: true });

    await fireEvent(screen.getByLabelText(t.settings.hidePhoneDefault), "valueChange", true);
    expect(await screen.findByText(t.settings.saveFailed)).toBeOnTheScreen();
    expect(screen.getByLabelText(t.settings.hidePhoneDefault)).toHaveProp("value", false);
    // A broker or admin cannot delete their account here.
    expect(screen.getByText(t.settings.deleteStaff)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: t.settings.deleteButton })).not.toBeOnTheScreen();
  });

  it("deletes the account once confirmed, signing out, and says when that fails", async () => {
    const fetchMock = serve({
      "/api/v1/me": answer(signedIn()),
      "GET /api/v1/settings": answer({ preferences, canDelete: true }),
      "DELETE /api/v1/account": [answer({ error: "staff" }, 403), answer({ ok: true })],
      "/api/v1/auth/logout": answer({ ok: true }),
    });
    await renderApp(<SettingsScreen />);
    expect(await screen.findByText(t.settings.deleteIntro)).toBeOnTheScreen();
    expect(screen.getByText(`• ${t.settings.deleteWhat[0]}`)).toBeOnTheScreen();
    const remove = async () => {
      await fireEvent.press(screen.getByRole("button", { name: t.settings.deleteButton }));
      const [question, , buttons] = alert.mock.calls.at(-1)!;
      expect(question).toBe(t.settings.deleteQuestion);
      expect((buttons as AlertButton[]).map((button) => button.text)).toEqual([t.settings.deleteNo, t.settings.deleteYes]);
      await waitFor(() => (buttons as AlertButton[])[1].onPress!());
    };
    await remove();
    await waitFor(() => expect(alert).toHaveBeenLastCalledWith(t.feedback.failed));
    await remove();
    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith("/account"));
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/api/v1/auth/logout"))).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls.find(([url]) => url.endsWith("/api/v1/account"))[1].body)).toEqual({ confirm: "yes" });
  });
});
