import { Linking } from "react-native";
import { router } from "expo-router";
import { apiUrl } from "./config";
import { routeForPath } from "./format";

/** Opens a site path where it belongs: the app's own screen when it has one, else the site's page in the browser. */
export function followPath(path: string): void {
  const route = routeForPath(path);
  if ("screen" in route) router.push(route.screen as never);
  else void Linking.openURL(apiUrl() + route.web);
}
