// Native modules have no implementation under Jest; each test sets what these return.
// The secure store starts empty in every test; `signedIn` in src/test/render.tsx fills it.
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => undefined), deleteItemAsync: jest.fn(async () => undefined) }));
jest.mock("expo-localization", () => ({ getLocales: jest.fn(() => [{ languageCode: "ka" }]) }));
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("expo-notifications", () => ({
  AndroidImportance: { DEFAULT: 3 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[test]" })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { extra: { apiUrl: "https://api.test/", eas: { projectId: "project" } } }, easConfig: null } }));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: (props) => require("react").createElement(View, props) };
});
jest.mock("@expo/vector-icons", () => ({ Ionicons: Object.assign(() => null, { glyphMap: {} }) }));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("expo-router", () => {
  const React = require("react");
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  const Screen = () => null;
  const navigator = (name) => Object.assign(({ children }) => React.createElement(React.Fragment, null, children), { Screen, displayName: name });
  return {
    router,
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (effect) => React.useEffect(effect, [effect]),
    // Like expo-router's Slot, which an asChild Link renders through: it throws on an array of styles.
    Link: ({ children, asChild }) => {
      if (asChild && Array.isArray(children.props.style)) throw new Error("[expo-router]: You are passing an array of styles to a child of <Slot>.");
      return children;
    },
    Stack: navigator("Stack"),
    Tabs: navigator("Tabs"),
  };
});

