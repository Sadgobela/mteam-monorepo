import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The password tests hash with the real scrypt cost (128 MB per hash), which takes several seconds on CI machines.
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
