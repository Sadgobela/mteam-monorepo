"use client";

import { useEffect, useState } from "react";
import { applyTheme, currentTheme, type Theme } from "@/lib/theme";

export function ThemeToggle({ labels }: { labels: { dark: string; light: string } }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => setTheme(currentTheme()), []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="btn ghost"
      aria-pressed={theme === "dark"}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
    >
      {theme === "dark" ? `☀ ${labels.light}` : `☾ ${labels.dark}`}
    </button>
  );
}
