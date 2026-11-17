import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import type { ReactNode } from "react";
import { answer } from "@/test/render";
import { setApiToken } from "./api";
import { SessionProvider, useSession } from "./session";

const store = SecureStore as jest.Mocked<typeof SecureStore>;
const fetchMock = jest.fn();
globalThis.fetch = fetchMock;

const me = { id: "u1", name: "Nino", phone: "+995555123456", role: "USER", onboarded: true, favoriteIds: [3] };
const wrapper = ({ children }: { children: ReactNode }) => <SessionProvider>{children}</SessionProvider>;
const lastHeaders = () => fetchMock.mock.calls.at(-1)[1].headers;

const start = async () => {
  const hook = await renderHook(() => useSession(), { wrapper });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook.result;
};

beforeEach(() => {
  fetchMock.mockReset();
  setApiToken(null);
});

describe("SessionProvider", () => {
  it("is signed out without a stored session, and refuses a heart", async () => {
    const session = await start();
    expect(session.current.user).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => expect(await session.current.toggleFavorite(3)).toBe(false));
  });

  it("restores a stored session with its favourites", async () => {
    store.getItemAsync.mockResolvedValueOnce("tok");
    fetchMock.mockResolvedValue(answer(me));
    const session = await start();
    expect(session.current.user).toEqual(me);
    expect(session.current.favoriteIds.has(3)).toBe(true);
    expect(lastHeaders().authorization).toBe("Bearer tok");
  });

  it("forgets a session the server no longer knows, but keeps it when offline", async () => {
    store.getItemAsync.mockResolvedValueOnce("old");
    fetchMock.mockResolvedValueOnce(answer({ error: "signedOut" }, 401));
    expect((await start()).current.user).toBeNull();
    expect(store.deleteItemAsync).toHaveBeenCalledWith("session");

    store.deleteItemAsync.mockClear();
    store.getItemAsync.mockResolvedValueOnce("tok");
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    expect((await start()).current.user).toBeNull();
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("signs in, sets hearts at once and puts them back when saving fails, and signs out", async () => {
    const session = await start();
    fetchMock.mockResolvedValueOnce(answer(me));
    await act(() => session.current.signIn("new"));
    expect(store.setItemAsync).toHaveBeenCalledWith("session", "new");
    expect(session.current.user?.id).toBe("u1");

    fetchMock.mockResolvedValueOnce(answer({ id: 5, favorite: true }));
    await act(async () => expect(await session.current.toggleFavorite(5)).toBe(true));
    expect(session.current.favoriteIds.has(5)).toBe(true);

    fetchMock.mockResolvedValueOnce(answer({ error: "failed" }, 500));
    await act(async () => void (await session.current.toggleFavorite(3)));
    expect(session.current.favoriteIds.has(3)).toBe(true);

    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await act(() => session.current.signOut());
    expect(session.current.user).toBeNull();
    expect(session.current.favoriteIds.size).toBe(0);
    expect(store.deleteItemAsync).toHaveBeenCalledWith("session");
  });

  it("needs its provider", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(renderHook(() => useSession())).rejects.toThrow("useSession outside SessionProvider");
  });
});
