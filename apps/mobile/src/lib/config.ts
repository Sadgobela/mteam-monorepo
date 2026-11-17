import Constants from "expo-constants";

const DEFAULT_API_URL = "https://mteam.vercel.app";

/** The site the app talks to: EXPO_PUBLIC_API_URL for a local server, else app.json's extra.apiUrl. */
export function apiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra?.apiUrl as string | undefined) || DEFAULT_API_URL;
  return configured.replace(/\/+$/, "");
}

/** The EAS project id, which Expo push tokens are issued for. Missing until the project is linked with `eas init`. */
export function easProjectId(): string | undefined {
  return (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId;
}

/**
 * Vercel's "Protection Bypass for Automation" key, while the site is open only to the team (Vercel Authentication).
 * Set EXPO_PUBLIC_VERCEL_BYPASS in apps/mobile/.env.local (gitignored), never in app.json or git: it is built into
 * the app, so only team builds may carry it. Remove it once the site is public.
 */
export function protectionBypass(): string | undefined {
  return process.env.EXPO_PUBLIC_VERCEL_BYPASS || undefined;
}
