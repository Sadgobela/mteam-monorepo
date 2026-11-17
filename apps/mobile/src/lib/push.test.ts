import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { answer } from "@/test/render";
import { pushIsOn, showWhileOpen, turnOffPush, turnOnPush } from "./push";

const notifications = Notifications as jest.Mocked<typeof Notifications>;
const store = SecureStore as jest.Mocked<typeof SecureStore>;
const device = Device as { isDevice: boolean };
const config = Constants as unknown as { expoConfig: { extra: { eas?: { projectId?: string } } } };
const fetchMock = jest.fn();
globalThis.fetch = fetchMock;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(answer({ ok: true }));
  device.isDevice = true;
  Platform.OS = "ios";
});

describe("showWhileOpen", () => {
  it("shows notifications that arrive while the app is open", async () => {
    showWhileOpen();
    const handler = notifications.setNotificationHandler.mock.calls[0][0];
    await expect(handler?.handleNotification({} as Notifications.Notification)).resolves.toMatchObject({ shouldShowBanner: true });
  });
});

describe("turnOnPush", () => {
  it("gives the server this phone's token, in the app's language", async () => {
    expect(await turnOnPush("en")).toBe("on");
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "project" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: "ExponentPushToken[test]", platform: "ios", locale: "en" });
    expect(store.setItemAsync).toHaveBeenCalledWith("pushToken", "ExponentPushToken[test]");
    expect(notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it("sets up Android's channel and asks for permission when not yet given", async () => {
    Platform.OS = "android";
    notifications.getPermissionsAsync.mockResolvedValueOnce({ status: "undetermined" } as never);
    expect(await turnOnPush("ka")).toBe("on");
    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith("default", { name: "MTeam", importance: 3 });
    expect(notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).platform).toBe("android");
  });

  it("says blocked when permission is refused", async () => {
    notifications.getPermissionsAsync.mockResolvedValueOnce({ status: "denied" } as never);
    notifications.requestPermissionsAsync.mockResolvedValueOnce({ status: "denied" } as never);
    expect(await turnOnPush("ka")).toBe("blocked");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is unavailable on a simulator or before the project is linked to EAS", async () => {
    device.isDevice = false;
    expect(await turnOnPush("ka")).toBe("unavailable");
    device.isDevice = true;
    const eas = config.expoConfig.extra.eas;
    config.expoConfig.extra.eas = undefined;
    expect(await turnOnPush("ka")).toBe("unavailable");
    config.expoConfig.extra.eas = eas;
  });
});

describe("turnOffPush", () => {
  it("removes the stored token from the server and the phone, even offline", async () => {
    store.getItemAsync.mockResolvedValueOnce("ExponentPushToken[test]");
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await turnOffPush();
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(store.deleteItemAsync).toHaveBeenCalledWith("pushToken");
  });

  it("does nothing when push was never on", async () => {
    store.getItemAsync.mockResolvedValueOnce(null);
    await turnOffPush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("pushIsOn", () => {
  it("reports whether a token is stored", async () => {
    store.getItemAsync.mockResolvedValueOnce("t").mockResolvedValueOnce(null);
    expect(await pushIsOn()).toBe(true);
    expect(await pushIsOn()).toBe(false);
  });
});
