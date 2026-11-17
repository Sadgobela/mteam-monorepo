import { renderHook } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { palettes, useColors } from "./theme";

describe("useColors", () => {
  it("follows the phone's light or dark setting", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    expect((await renderHook(() => useColors())).result.current).toBe(palettes.dark);
    scheme.mockReturnValue("light");
    expect((await renderHook(() => useColors())).result.current).toBe(palettes.light);
    scheme.mockRestore();
  });
});
