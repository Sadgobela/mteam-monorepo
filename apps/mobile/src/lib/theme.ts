import { useColorScheme } from "react-native";

/** The site's colour tokens (apps/web/src/app/globals.css), light and dark, and the see-through wash of the floating menu. */
export const palettes = {
  light: { brand: "#986dc6", brandDeep: "#6e45a0", brandSoft: "#f1eaf8", bg: "#faf8fc", surface: "#ffffff", fg: "#1f1828", muted: "#6b6176", line: "#e6dfee", action: "#986dc6", onAction: "#ffffff", wa: "#1f9d57", danger: "#c0392b", logo: "#986dc6", glass: "rgba(255, 255, 255, 0.62)", glassLine: "rgba(31, 24, 40, 0.08)" },
  dark: { brand: "#a57fd0", brandDeep: "#c8aee6", brandSoft: "#2a2136", bg: "#141019", surface: "#1d1724", fg: "#f1ecf6", muted: "#a79db3", line: "#332a3e", action: "#986dc6", onAction: "#ffffff", wa: "#1f9d57", danger: "#e57368", logo: "#ffffff", glass: "rgba(29, 23, 36, 0.62)", glassLine: "rgba(255, 255, 255, 0.1)" },
};

export type Palette = (typeof palettes)["light"];

/** The spacing and radius scale. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

/** Follows the phone's light or dark setting, as the site follows the system's. */
export function useColors(): Palette {
  return useColorScheme() === "dark" ? palettes.dark : palettes.light;
}
