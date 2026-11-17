import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import type { PublicListing } from "@mteam/shared";
import { answer, listing, renderApp } from "@/test/render";
import { ListingCard } from "./ListingCard";
import { SignInPrompt } from "./SignInPrompt";
import { Button, ChipRow, Field, Heading, Note, ScreenState } from "./ui";

const fetchMock = jest.fn();
globalThis.fetch = fetchMock;
const flat = listing as unknown as PublicListing;

describe("ui", () => {
  it("presses a button, and not while it is busy or off", async () => {
    const press = jest.fn();
    await render(
      <>
        <Button label="Go" onPress={press} />
        <Button quiet label="Quiet" onPress={press} />
        <Button busy label="Busy" onPress={press} />
        <Button quiet busy label="Quiet busy" onPress={press} />
        <Button disabled label="Off" onPress={press} />
      </>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Go" }));
    await fireEvent.press(screen.getByRole("button", { name: "Quiet" }));
    await fireEvent.press(screen.getByRole("button", { name: "Busy" }));
    await fireEvent.press(screen.getByRole("button", { name: "Off" }));
    expect(press).toHaveBeenCalledTimes(2);
  });

  it("chooses a chip, and clears it when chosen again", async () => {
    const change = jest.fn();
    await render(<ChipRow options={["a", "b"]} value="a" onChange={change} label={(v) => v.toUpperCase()} />);
    await fireEvent.press(screen.getByText("A"));
    await fireEvent.press(screen.getByText("B"));
    expect(change.mock.calls).toEqual([[undefined], ["b"]]);
  });

  it("labels a field and shows headings and notes", async () => {
    await render(
      <>
        <Field label="Name" value="Nino" />
        <Heading>Title</Heading>
        <Note>Plain</Note>
        <Note tone="danger">Wrong</Note>
      </>,
    );
    expect(screen.getByLabelText("Name")).toHaveDisplayValue("Nino");
    expect(screen.getByRole("header", { name: "Title" })).toBeOnTheScreen();
    expect(screen.getByText("Wrong")).toBeOnTheScreen();
  });

  it("shows loading, a failure with a retry, and an empty note", async () => {
    const retry = jest.fn();
    await render(
      <>
        <ScreenState state="loading" />
        <ScreenState state="failed" onRetry={retry} />
        <ScreenState state="failed" />
        <ScreenState state="empty" empty="Nothing" />
        <ScreenState state="empty" />
      </>,
    );
    expect(screen.getByLabelText("loading")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "თავიდან ცდა" }));
    expect(retry).toHaveBeenCalled();
    expect(screen.getByText("Nothing")).toBeOnTheScreen();
  });
});

describe("SignInPrompt", () => {
  it("leads to sign-in", async () => {
    await renderApp(<SignInPrompt />);
    await fireEvent.press(screen.getByRole("button", { name: "შესვლა" }));
    expect(router.push).toHaveBeenCalledWith("/login");
  });
});

describe("ListingCard", () => {
  it("shows the price, title and facts, and asks a signed-out user to sign in for the heart", async () => {
    const signIn = jest.fn();
    await renderApp(<ListingCard listing={flat} gelPerUsd={2.7} onSignIn={signIn} />);
    expect(screen.getByText("$120,000")).toBeOnTheScreen();
    expect(screen.getByText("MTeam Verified")).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole("button", { name: "რჩეულებში დამატება" }));
    expect(signIn).toHaveBeenCalled();
  });

  it("shows a placeholder without photos, and no badge when not verified", async () => {
    await renderApp(<ListingCard listing={{ ...flat, images: [], verified: false }} gelPerUsd={2.7} onSignIn={jest.fn()} />);
    expect(screen.queryByText("MTeam Verified")).not.toBeOnTheScreen();
    expect(screen.queryByLabelText("ფოტო")).not.toBeOnTheScreen();
  });

  it("fills the heart for a favourite of a signed-in user", async () => {
    const SecureStore = jest.requireMock("expo-secure-store");
    SecureStore.getItemAsync.mockResolvedValueOnce("tok");
    fetchMock.mockResolvedValueOnce(answer({ id: "u1", name: "N", phone: null, role: "USER", onboarded: true, favoriteIds: [7] }));
    const signIn = jest.fn();
    await renderApp(<ListingCard listing={flat} gelPerUsd={2.7} onSignIn={signIn} />);
    const heart = await screen.findByRole("button", { name: "რჩეულებიდან ამოღება" });
    fetchMock.mockResolvedValueOnce(answer({ id: 7, favorite: false }));
    await fireEvent.press(heart);
    expect(await screen.findByRole("button", { name: "რჩეულებში დამატება" })).toBeOnTheScreen();
    expect(signIn).not.toHaveBeenCalled();
  });
});
