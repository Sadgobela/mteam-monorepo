import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, setApiToken, type Me } from "./api";
import { readStored, writeStored } from "./storage";

const KEY = "session";

interface SessionValue {
  /** False until the stored session has been checked, so screens do not flash the signed-out state. */
  ready: boolean;
  user: Me | null;
  favoriteIds: Set<number>;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Sets a heart at once and puts it back if saving fails, as on the site. Signed out it does nothing and says so. */
  toggleFavorite: (id: number) => Promise<boolean>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Me | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
      setFavoriteIds(new Set(me.favoriteIds));
    } catch (error) {
      // An expired or revoked session is forgotten; being offline keeps it for next time.
      if (error instanceof ApiError && error.status === 401) {
        setApiToken(null);
        await writeStored(KEY, null);
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    readStored(KEY).then(async (token) => {
      if (token) {
        setApiToken(token);
        await load();
      }
      setReady(true);
    });
  }, [load]);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      user,
      favoriteIds,
      refresh: load,
      signIn: async (token) => {
        setApiToken(token);
        await writeStored(KEY, token);
        await load();
      },
      signOut: async () => {
        await api.logout().catch(() => undefined);
        setApiToken(null);
        await writeStored(KEY, null);
        setUser(null);
        setFavoriteIds(new Set());
      },
      toggleFavorite: async (id) => {
        if (!user) return false;
        const want = !favoriteIds.has(id);
        const flip = (on: boolean) =>
          setFavoriteIds((current) => {
            const next = new Set(current);
            if (on) next.add(id);
            else next.delete(id);
            return next;
          });
        flip(want);
        try {
          await api.setFavorite(id, want);
        } catch {
          flip(!want);
        }
        return true;
      },
    }),
    [ready, user, favoriteIds, load],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession outside SessionProvider");
  return value;
}
