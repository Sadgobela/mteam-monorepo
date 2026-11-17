/** Tests run under jest-expo, Expo's preset for React Native. 100% coverage, as in the rest of the repo. */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["./jest.setup.js"],
  setupFilesAfterEnv: ["./jest.after-env.js"],
  // Every test starts from fresh mocks: each sets what it needs.
  resetMocks: false,
  clearMocks: true,
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  // pnpm keeps packages under node_modules/.pnpm, so the preset's list of packages to compile must allow that prefix.
  transformIgnorePatterns: [
    "node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|@mteam/.*))",
  ],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.test.{ts,tsx}", "!src/test/**", "!src/screens.test/**"],
  coverageThreshold: { global: { lines: 100, branches: 100, functions: 100, statements: 100 } },
};
