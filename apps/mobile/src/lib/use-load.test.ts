import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useLoad, type Loaded } from "./use-load";

describe("useLoad", () => {
  it("loads, says when that failed, and retries", async () => {
    const load = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce("done");
    const { result } = await renderHook(() => useLoad(load));
    await waitFor(() => expect(result.current.state).toBe("failed"));
    expect(result.current.data).toBeNull();
    await act(async () => result.current.retry());
    expect(result.current).toMatchObject({ state: "ready", data: "done" });
  });

  it("shows loading for a new request, and never the answer of one asked before it", async () => {
    let answerFirst: (value: string) => void = () => undefined;
    const first = jest.fn(() => new Promise<string>((resolve) => (answerFirst = resolve)));
    let failFirst: (error: Error) => void = () => undefined;
    const lost = jest.fn(() => new Promise<string>((_resolve, reject) => (failFirst = reject)));
    const second = jest.fn(async () => "second");
    const { result, rerender } = await renderHook<Loaded<string>, { load: () => Promise<string> }>(({ load }) => useLoad(load), { initialProps: { load: first } });
    await rerender({ load: second });
    await waitFor(() => expect(result.current).toMatchObject({ state: "ready", data: "second" }));
    await act(async () => answerFirst("first"));
    expect(result.current.data).toBe("second");

    await rerender({ load: lost });
    expect(result.current.state).toBe("loading");
    await rerender({ load: second });
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => failFirst(new Error("offline")));
    expect(result.current).toMatchObject({ state: "ready", data: "second" });
  });
});
