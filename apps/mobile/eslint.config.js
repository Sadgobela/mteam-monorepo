// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", "coverage/*", ".expo/*", "expo-env.d.ts"] },
  // Jest's set-up files are plain scripts that run with Jest's globals.
  { files: ["jest.*.js"], languageOptions: { globals: { jest: "readonly", beforeEach: "readonly" } } },
]);
