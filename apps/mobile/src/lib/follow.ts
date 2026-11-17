import { Linking } from "react-native";
import { router } from "expo-router";
import { apiUrl } from "./config";
import { routeForPath } from "./format";

/** Switches tab from anywhere: screens opened on top of the tabs (a listing) close first, so the tabs never stack twice. */
export function switchTab(href: string): void {
  if (router.canDismiss()) router.dismissAll();
  router.navigate(href as never);
}

/**
 * Opens a site path where it belongs: the app's own screen or tab when it has one, else the site's page in the browser.
 * Only a path on the site is followed: a push could carry ".evil.tld" or "@evil.tld", which would lead off it.
 */
export function followPath(path: string): void {
  if (!path.startsWith("/")) return;
  const route = routeForPath(path);
  if ("tab" in route) switchTab(route.tab);
  else if ("screen" in route) router.push(route.screen as never);
  else void Linking.openURL(apiUrl() + route.web);
}
