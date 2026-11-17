import { Linking } from "react-native";
import { render, screen } from "@testing-library/react-native";
import type { NotificationResponse } from "expo-notifications";
import { palettes } from "@/lib/theme";
import TabsLayout, { tabIcon } from "@/app/(tabs)/_layout";
import RootLayout, { openNotification } from "@/app/_layout";

const { router } = jest.requireMock("expo-router");
const notifications = jest.requireMock("expo-notifications");
const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
const tapped = (data: unknown) => ({ notification: { request: { content: { data } } } }) as unknown as NotificationResponse;

describe("openNotification", () => {
  it("opens the app's screen for a listing, the site for anything else, and nothing without an address", () => {
    openNotification(tapped({ url: "/ka/listings/7" }));
    expect(router.push).toHaveBeenCalledWith("/listings/7");
    openNotification(tapped({ url: "/ka/messages/c1" }));
    expect(openURL).toHaveBeenCalledWith("https://api.test/ka/messages/c1");
    openNotification(tapped(undefined));
    expect(router.push).toHaveBeenCalledTimes(1);
  });
});

describe("RootLayout", () => {
  it("listens for tapped notifications while mounted", async () => {
    const remove = jest.fn();
    notifications.addNotificationResponseReceivedListener.mockReturnValueOnce({ remove });
    const view = await render(<RootLayout />);
    expect(notifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(openNotification);
    await view.unmount();
    expect(remove).toHaveBeenCalled();
  });
});

describe("TabsLayout", () => {
  it("renders, with icons in the brand colour on the open tab", async () => {
    await render(<TabsLayout />);
    expect(screen.toJSON()).toBeNull();
    const Icon = tabIcon("search", palettes.light);
    expect(Icon({ focused: true, size: 20 }).props).toMatchObject({ name: "search", color: palettes.light.brand, size: 20 });
    expect(Icon({ focused: false, size: 20 }).props.color).toBe(palettes.light.muted);
  });
});
