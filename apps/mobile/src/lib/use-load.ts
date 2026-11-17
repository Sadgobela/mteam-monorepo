import { useCallback, useEffect, useRef, useState } from "react";

export type LoadState = "loading" | "failed" | "ready";

/** Narrowed by `state`: the data is there exactly when it is "ready". */
export type Loaded<T> = { state: "ready"; data: T; retry: () => void } | { state: "loading" | "failed"; data: null; retry: () => void };

/** `from` is the request this answers, so the answer to an earlier one (other filters) is never shown as this one's. */
type Answer<T> = { from: () => Promise<T> } & ({ failed: false; data: T } | { failed: true });

/**
 * What a screen shows from one request: the answer once it comes, whether it is still loading or failed, and a retry.
 * `load` must keep its identity between renders (wrap it in useCallback); a new one, for other filters, asks again and
 * shows loading until its own answer comes.
 */
export function useLoad<T>(load: () => Promise<T>): Loaded<T> {
  const [answer, setAnswer] = useState<Answer<T> | null>(null);
  const latest = useRef(load);
  const run = useCallback(
    () =>
      load().then(
        (data) => latest.current === load && setAnswer({ from: load, data, failed: false }),
        () => latest.current === load && setAnswer({ from: load, failed: true }),
      ),
    [load],
  );
  useEffect(() => {
    latest.current = load;
    void run();
  }, [load, run]);
  const current = answer?.from === load ? answer : null;
  const retry = () => {
    setAnswer(null);
    void run();
  };
  if (current === null || current.failed) return { state: current === null ? "loading" : "failed", data: null, retry };
  return { state: "ready", data: current.data, retry };
}
