import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle";

const labels = { dark: "Dark mode", light: "Light mode" };

describe("ThemeToggle", () => {
  it("switches between light and dark", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    render(<ThemeToggle labels={labels} />);
    const button = screen.getByRole("button", { name: /Dark mode/ });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: /Light mode/ })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: /Light mode/ }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
