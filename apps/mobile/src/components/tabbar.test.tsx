import { Keyboard } from "react-native";
import * as ReactNative from "react-native";
import { act, fireEvent, renderHook, screen } from "@testing-library/react-native";
import { answer, renderApp, serve, signedIn } from "@/test/render";
import { BAR_HEIGHT, openTab, TabBar, useBarSpace } from "./TabBar";

const { router, usePathname } = jest.requireMock("expo-router");
const haptics = jest.requireMock("expo-haptics");

describe("TabBar", () => {
  it("shows the five tabs with the open one marked, and opens a tab with a tap", async () => {
    serve({});
    usePathname.mockReturnValue("/favorites");
    await renderApp(<TabBar />);
    expect(screen.getByLabelText("მთავარი მენიუ")).toBeOnTheScreen();
    expect(screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel)).toEqual(["ძიება", "რჩეულები", "დამატება", "სიახლეები", "ანგარიში"]);
    expect(screen.getByRole("tab", { name: "რჩეულები" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "ძიება" })).not.toBeSelected();
    await fireEvent.press(screen.getByRole("tab", { name: "დამატება" }));
    expect(router.navigate).toHaveBeenCalledWith("/post");
    await fireEvent.press(screen.getByRole("tab", { name: "სიახლეები" }));
    expect(router.navigate).toHaveBeenCalledWith("/notifications");
    expect(haptics.selectionAsync).toHaveBeenCalledTimes(2);
  });

  it("marks the raised post button as open on its screen, in the dark theme too", async () => {
    serve({});
    usePathname.mockReturnValue("/post");
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    await renderApp(<TabBar />);
    expect(screen.getByRole("tab", { name: "დამატება" })).toBeSelected();
    scheme.mockRestore();
  });

  it("shows the unread count on notifications, 9+ past nine", async () => {
    serve({ "/api/v1/me": [answer(signedIn({ unread: 3 })), answer(signedIn({ unread: 12 }))] });
    const view = await renderApp(<TabBar />);
    expect(await screen.findByRole("tab", { name: "შეტყობინებები, წაუკითხავი: 3" })).toHaveTextContent(/3/);
    await view.unmount();
    await renderApp(<TabBar />);
    expect(await screen.findByRole("tab", { name: "შეტყობინებები, წაუკითხავი: 12" })).toHaveTextContent(/9\+/);
  });

  it("is not on sign-in, and steps aside while the keyboard is open", async () => {
    serve({});
    const listeners: Record<string, () => void> = {};
    const remove = jest.fn();
    jest.spyOn(Keyboard, "addListener").mockImplementation((event, listener) => {
      listeners[event] = listener as () => void;
      return { remove } as unknown as ReturnType<typeof Keyboard.addListener>;
    });
    usePathname.mockReturnValue("/login");
    const signIn = await renderApp(<TabBar />);
    expect(screen.queryByLabelText("მთავარი მენიუ")).not.toBeOnTheScreen();
    await signIn.unmount();
    remove.mockClear();
    usePathname.mockReturnValue("/");
    const view = await renderApp(<TabBar />);
    expect(screen.getByLabelText("მთავარი მენიუ")).toBeOnTheScreen();
    await act(() => listeners.keyboardDidShow());
    expect(screen.queryByLabelText("მთავარი მენიუ")).not.toBeOnTheScreen();
    await act(() => listeners.keyboardDidHide());
    expect(screen.getByLabelText("მთავარი მენიუ")).toBeOnTheScreen();
    await view.unmount();
    expect(remove).toHaveBeenCalledTimes(2);
  });
});

describe("openTab", () => {
  it("closes screens opened over the tabs first", () => {
    router.canDismiss.mockReturnValueOnce(true);
    openTab("/account");
    expect(router.dismissAll).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith("/account");
  });
});

describe("useBarSpace", () => {
  it("leaves room for the menu above the home indicator", async () => {
    const { result } = await renderHook(() => useBarSpace());
    expect(result.current).toBeGreaterThan(BAR_HEIGHT);
  });
});

afterEach(() => {
  usePathname.mockReturnValue("/");
});
