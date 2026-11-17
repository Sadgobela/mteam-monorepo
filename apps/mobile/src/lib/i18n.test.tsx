import { Text } from "react-native";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { deviceLocale, fill, LocaleProvider, useLocale } from "./i18n";

const locales = getLocales as jest.Mock;
const store = SecureStore as jest.Mocked<typeof SecureStore>;

function Probe() {
  const { locale, t, setLocale } = useLocale();
  return (
    <Text onPress={() => setLocale("ru")}>
      {locale}:{t.nav.login}
    </Text>
  );
}

describe("deviceLocale", () => {
  it("uses the phone's language when the app has it, else Georgian", () => {
    locales.mockReturnValueOnce([{ languageCode: "en" }]).mockReturnValueOnce([{ languageCode: "de" }]).mockReturnValueOnce([]);
    expect(deviceLocale()).toBe("en");
    expect(deviceLocale()).toBe("ka");
    expect(deviceLocale()).toBe("ka");
  });
});

describe("LocaleProvider", () => {
  it("starts from the stored language and remembers a new choice", async () => {
    store.getItemAsync.mockResolvedValueOnce("en");
    await render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    expect(await screen.findByText("en:Sign in")).toBeOnTheScreen();
    await act(async () => screen.getByText("en:Sign in").props.onPress());
    expect(screen.getByText("ru:Войти")).toBeOnTheScreen();
    expect(store.setItemAsync).toHaveBeenCalledWith("locale", "ru");
  });

  it("ignores a stored value that is not a language", async () => {
    store.getItemAsync.mockResolvedValueOnce("xx");
    await render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    await waitFor(() => expect(store.getItemAsync).toHaveBeenCalledWith("locale"));
    expect(screen.getByText("ka:შესვლა")).toBeOnTheScreen();
  });

  it("works in Georgian without a provider", async () => {
    const { result } = await renderHook(() => useLocale());
    expect(result.current.locale).toBe("ka");
    expect(result.current.setLocale("en")).toBeUndefined();
  });
});

describe("fill", () => {
  it("fills known placeholders and leaves others", () => {
    expect(fill("{count} of {total}", { count: 2 })).toBe("2 of {total}");
  });
});
