import { AccessibilityInfo, Animated } from "react-native";
import * as ReactNative from "react-native";
import { render, screen, waitFor } from "@testing-library/react-native";
import { BootScreen, MarkLoader, spreadCurve, Wordmark } from "./Brand";

describe("spreadCurve", () => {
  it("starts and ends assembled, rests first, and is apart in between", () => {
    const { inputRange, outputRange } = spreadCurve();
    expect(inputRange[0]).toBe(0);
    expect(inputRange.at(-1)).toBeCloseTo(1);
    expect(inputRange.every((at, index) => index === 0 || at > inputRange[index - 1])).toBe(true);
    expect(outputRange.slice(0, 2)).toEqual([0, 0]);
    expect(Math.max(...outputRange)).toBeCloseTo(1);
    expect(outputRange.at(-1)).toBeCloseTo(0);
  });
});

describe("MarkLoader", () => {
  it("draws the four arrows and runs while shown", async () => {
    const loop = jest.spyOn(Animated, "loop");
    const view = await render(<MarkLoader size={64} color="#fff" label="loading" />);
    expect(screen.getByLabelText("loading")).toBeOnTheScreen();
    expect(screen.getAllByTestId("mark-arm")).toHaveLength(4);
    await waitFor(() => expect(loop).toHaveBeenCalled());
    const stop = jest.spyOn(loop.mock.results[0].value, "stop");
    await view.unmount();
    expect(stop).toHaveBeenCalled();
    loop.mockRestore();
  });

  it("stays still with reduced motion, and does not start once gone", async () => {
    const loop = jest.spyOn(Animated, "loop");
    const reduce = jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValueOnce(true);
    await render(<MarkLoader color="#fff" />);
    await waitFor(() => expect(reduce).toHaveBeenCalled());
    let answer: (value: boolean) => void = () => undefined;
    reduce.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const view = await render(<MarkLoader color="#fff" />);
    await view.unmount();
    answer(false);
    await Promise.resolve();
    expect(loop).not.toHaveBeenCalled();
    loop.mockRestore();
  });
});

describe("Wordmark", () => {
  it("is named for screen readers", async () => {
    await render(<Wordmark width={84} color="#fff" />);
    expect(screen.getByLabelText("MTeam")).toBeOnTheScreen();
  });
});

describe("BootScreen", () => {
  it("covers the app on the brand colour until it is done, then fades away", async () => {
    const view = await render(<BootScreen done={false} />);
    expect(screen.getByTestId("boot")).toHaveStyle({ backgroundColor: "#986dc6" });
    await view.rerender(<BootScreen done />);
    await waitFor(() => expect(screen.queryByTestId("boot")).not.toBeOnTheScreen());
  });

  it("is dark in the dark theme, as the splash screen is", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    await render(<BootScreen done={false} />);
    expect(screen.getByTestId("boot")).toHaveStyle({ backgroundColor: "#141019" });
    scheme.mockRestore();
  });
});
