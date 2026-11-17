import * as SecureStore from "expo-secure-store";
import { readStored, writeStored } from "./storage";

const store = SecureStore as jest.Mocked<typeof SecureStore>;

describe("storage", () => {
  it("reads, writes and deletes in the secure store", async () => {
    store.getItemAsync.mockResolvedValueOnce("v");
    expect(await readStored("k")).toBe("v");
    await writeStored("k", "v");
    expect(store.setItemAsync).toHaveBeenCalledWith("k", "v");
    await writeStored("k", null);
    expect(store.deleteItemAsync).toHaveBeenCalledWith("k");
  });

  it("treats a failing store as empty and never throws", async () => {
    store.getItemAsync.mockRejectedValueOnce(new Error("locked"));
    expect(await readStored("k")).toBeNull();
    store.setItemAsync.mockRejectedValueOnce(new Error("locked"));
    await expect(writeStored("k", "v")).resolves.toBeUndefined();
  });
});
