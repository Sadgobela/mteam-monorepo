import { describe, expect, it, vi } from "vitest";
import { applyTheme, currentTheme, THEME_KEY, themeInitScript } from "./theme";

function mockSystemDark(dark: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: dark }) as unknown as typeof window.matchMedia;
}

describe("theme", () => {
  it("uses the explicit data-theme when set", () => {
    document.documentElement.dataset.theme = "dark";
    expect(currentTheme()).toBe("dark");
    document.documentElement.dataset.theme = "light";
    expect(currentTheme()).toBe("light");
  });

  it("falls back to the system setting", () => {
    mockSystemDark(true);
    expect(currentTheme()).toBe("dark");
    mockSystemDark(false);
    expect(currentTheme()).toBe("light");
  });

  it("applies and saves the theme", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  it("still applies the theme when storage is blocked", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    spy.mockRestore();
  });

  it("init script restores a saved theme", () => {
    localStorage.setItem(THEME_KEY, "dark");
    new Function(themeInitScript)();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
