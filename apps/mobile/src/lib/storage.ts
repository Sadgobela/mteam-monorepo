import * as SecureStore from "expo-secure-store";

/** Small values kept on the phone: the session token in the secure store, as is the chosen language. Failures read as nothing. */
export async function readStored(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function writeStored(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // Nothing to do: the value is simply not remembered next time.
  }
}
