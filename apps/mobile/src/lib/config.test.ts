import Constants from "expo-constants";
import { apiUrl, easProjectId, protectionBypass } from "./config";

const config = Constants as unknown as { expoConfig: { extra?: Record<string, unknown> } | null; easConfig: { projectId?: string } | null };
const saved = config.expoConfig;

afterEach(() => {
  config.expoConfig = saved;
  config.easConfig = null;
  delete process.env.EXPO_PUBLIC_API_URL;
  delete process.env.EXPO_PUBLIC_VERCEL_BYPASS;
});

describe("config", () => {
  it("uses the local server when set, else app.json, else the live site, without a trailing slash", () => {
    expect(apiUrl()).toBe("https://api.test");
    process.env.EXPO_PUBLIC_API_URL = "http://192.168.1.5:3000";
    expect(apiUrl()).toBe("http://192.168.1.5:3000");
    delete process.env.EXPO_PUBLIC_API_URL;
    config.expoConfig = null;
    expect(apiUrl()).toBe("https://mteam-phi.vercel.app");
  });

  it("has a protection bypass key only when one is set", () => {
    expect(protectionBypass()).toBeUndefined();
    process.env.EXPO_PUBLIC_VERCEL_BYPASS = "test-key";
    expect(protectionBypass()).toBe("test-key");
  });

  it("reads the EAS project id from app.json or the build", () => {
    expect(easProjectId()).toBe("project");
    config.expoConfig = { extra: {} };
    config.easConfig = { projectId: "built" };
    expect(easProjectId()).toBe("built");
    config.easConfig = null;
    config.expoConfig = null;
    expect(easProjectId()).toBeUndefined();
  });
});
