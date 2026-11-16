import type { MetadataRoute } from "next";
import { defaultLocale, getDictionary } from "@mteam/shared";

/**
 * Makes the site installable, which iPhones require before they show its push notifications. A manifest cannot read
 * CSS tokens, so the colours are the brand purple and the light theme's --bg from globals.css.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MTeam",
    short_name: "MTeam",
    description: getDictionary(defaultLocale).meta.description,
    start_url: `/${defaultLocale}`,
    scope: "/",
    display: "standalone",
    theme_color: "#986DC6",
    background_color: "#faf8fc",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
