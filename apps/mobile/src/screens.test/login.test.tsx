import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { answer, me, renderApp, serve } from "@/test/render";
import LoginScreen from "@/app/login";
import OnboardingScreen from "@/app/onboarding";

const { router } = jest.requireMock("expo-router");

describe("LoginScreen", () => {
  it("sends a code, signs in with it and continues to onboarding for a new account", async () => {
    const fetchMock = serve({
      "/api/v1/auth/code": answer({ phone: "+995555123456" }),
      "/api/v1/auth/verify": [answer({ token: "tok", onboarded: false }), answer({ token: "tok", onboarded: true })],
      "/api/v1/me": answer(me),
    });
    await renderApp(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText("მობილურის ნომერი"), "555 12 34 56");
    await fireEvent.press(screen.getByRole("button", { name: "კოდის გაგზავნა" }));
    expect(await screen.findByText("კოდი გაიგზავნა ნომერზე +995555123456")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText("SMS კოდი"), "123456");
    await fireEvent.press(screen.getByRole("button", { name: "შესვლა" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/onboarding"));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ phone: "+995555123456", code: "123456" });
    await fireEvent.press(screen.getByRole("button", { name: "შესვლა" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account"));
  });

  it("shows the server's reason, and a general one for anything else", async () => {
    serve({ "/api/v1/auth/code": [answer({ error: "invalidPhone" }, 400), new TypeError("offline"), answer({ phone: "+995555123456" })], "/api/v1/auth/verify": answer({ error: "wrongCode" }, 401) });
    await renderApp(<LoginScreen />);
    const send = screen.getByRole("button", { name: "კოდის გაგზავნა" });
    await fireEvent.press(send);
    expect(await screen.findByText("შეიყვანე საქართველოს მობილურის ნომერი, მაგალითად 555 12 34 56.")).toBeOnTheScreen();
    await fireEvent.press(send);
    expect(await screen.findByText("ვერ ჩაიტვირთა. შეამოწმე ინტერნეტი და სცადე თავიდან.")).toBeOnTheScreen();
    await fireEvent.press(send);
    await fireEvent.press(await screen.findByRole("button", { name: "შესვლა" }));
    expect(await screen.findByText("კოდი არასწორია ან ვადა გაუვიდა.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "ნომრის შეცვლა" }));
    expect(screen.getByLabelText("მობილურის ნომერი")).toBeOnTheScreen();
  });
});

describe("OnboardingScreen", () => {
  it("asks again until the name, the reason and the terms are given, then saves", async () => {
    const fetchMock = serve({ "/api/v1/onboarding": [new TypeError("offline"), answer({ ok: true })], "/api/v1/me": answer(me) });
    await renderApp(<OnboardingScreen />);
    const start = screen.getByRole("button", { name: "დაწყება" });
    await fireEvent.press(start);
    const invalid = "შეიყვანე სახელი (2-დან 60 სიმბოლომდე), აირჩიე, რამ მოგიყვანა, და დაეთანხმე წესებს.";
    expect(screen.getByText(invalid)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText("შენი სახელი"), " Nino ");
    await fireEvent.press(screen.getByText("ვარ ბროკერი"));
    expect(screen.getByText("მშვენიერია! MTeam დაგიკავშირდება თანამშრომლობაზე სასაუბროდ.")).toBeOnTheScreen();
    await fireEvent(screen.getByLabelText("ვეთანხმები საიტის გამოყენების წესებს"), "valueChange", true);
    await fireEvent.press(start);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await fireEvent.press(start);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: "Nino", intent: "BROKER", terms: true });
  });
});
