import { Alert, type AlertButton } from "react-native";
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { formatDay, getDictionary, type PublicListing } from "@mteam/shared";
import { cardTitle } from "@/lib/format";
import { answer, listing, renderApp, serve, signedIn } from "@/test/render";
import MyListingsScreen from "@/app/my-listings";

const { router } = jest.requireMock("expo-router");
const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
const t = getDictionary("ka");

const mine = (id: number, status: string, extra: object = {}) => ({
  ...listing,
  id,
  status,
  views: 10,
  phoneReveals: 2,
  favorites: 3,
  conversations: 1,
  canRenew: false,
  canBump: false,
  expiresAt: null,
  nextBumpAt: null,
  ...extra,
});
const page = (tab: string, counts: object, listings: unknown[]) =>
  answer({ tab, counts: { active: 0, pending: 0, draft: 0, expiring: 0, archived: 0, rejected: 0, ...counts }, listings, gelPerUsd: 2.7 });
const counts = { active: 1, pending: 1, expiring: 1 };
/** The question an Alert asked, with its yes pressed. */
const sayYes = async (question: string) => {
  const call = alert.mock.calls.find(([title]) => title === question)!;
  await waitFor(() => (call[2] as AlertButton[])[1].onPress!());
};
const deferred = () => {
  let settle: { resolve: (value: Response) => void; reject: (error: Error) => void } = { resolve: () => undefined, reject: () => undefined };
  const promise = new Promise<Response>((resolve, reject) => (settle = { resolve, reject }));
  return { reply: () => promise, ...settle };
};

describe("MyListingsScreen", () => {
  it("asks a signed-out user to sign in", async () => {
    serve({});
    await renderApp(<MyListingsScreen />);
    expect(await screen.findByRole("button", { name: "შესვლა" })).toBeOnTheScreen();
  });

  it("retries a failure, and says when nothing was posted", async () => {
    serve({ "/api/v1/me": answer(signedIn()), "/api/v1/my-listings": [new TypeError("offline"), page("active", {}, [])] });
    await renderApp(<MyListingsScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    expect(await screen.findByText(t.my.empty)).toBeOnTheScreen();
  });

  it("shows a tab with each listing's numbers and actions, and opens another tab", async () => {
    const expiresAt = "2026-12-01T10:00:00Z";
    const fetchMock = serve({
      "/api/v1/me": answer(signedIn()),
      "/api/v1/my-listings": [
        page("active", counts, [mine(7, "ACTIVE", { expiresAt, marketLevel: 2 })]),
        new TypeError("offline"),
        page("pending", counts, [mine(8, "PENDING", { nextBumpAt: "2026-11-18T10:00:00Z" })]),
        page("pending", counts, []),
      ],
    });
    await renderApp(<MyListingsScreen />);
    const row = await screen.findByTestId("mine-7");
    expect(within(row).getByText("№ 7")).toBeOnTheScreen();
    expect(within(row).getByText("გამოქვეყნებული")).toBeOnTheScreen();
    expect(within(row).getByText("$120,000 · Chavchavadze 1")).toBeOnTheScreen();
    expect(within(row).getByText("ნახვა: 10 · ნომრის ნახვა: 2 · რჩეულებში: 3 · მიწერა: 1")).toBeOnTheScreen();
    expect(within(row).getByText(`${t.market.heading}: ${t.market.levels[1]}`)).toBeOnTheScreen();
    expect(within(row).getByText(`აქტიურია ${formatDay(expiresAt, "ka")}-მდე`)).toBeOnTheScreen();
    expect(within(row).queryByRole("button", { name: t.myListings.bump })).not.toBeOnTheScreen();
    expect(within(row).queryByRole("button", { name: t.ui.deleteDraft })).not.toBeOnTheScreen();
    await fireEvent.press(within(row).getByRole("button", { name: "ნახვა" }));
    expect(router.push).toHaveBeenCalledWith("/listings/7");
    await fireEvent.press(within(row).getByRole("button", { name: "რედაქტირება" }));
    expect(router.push).toHaveBeenCalledWith("/edit/7");

    // The open tab pressed again stays open, without asking again.
    const asked = fetchMock.mock.calls.length;
    await fireEvent.press(screen.getByRole("button", { name: "აქტიური (1)" }));
    expect(screen.getByRole("button", { name: "აქტიური (1)" })).toBeSelected();
    expect(fetchMock.mock.calls.length).toBe(asked);

    await fireEvent.press(screen.getByRole("button", { name: "მოდერაციაზე (1)" }));
    await fireEvent.press(await screen.findByRole("button", { name: "თავიდან ცდა" }));
    const pending = await screen.findByTestId("mine-8");
    expect(within(pending).getByText("შემდეგი უფასო აწევა: 18 ნოე, 14:00")).toBeOnTheScreen();
    expect(within(pending).queryByRole("button", { name: "ნახვა" })).not.toBeOnTheScreen();
    expect(within(pending).getByRole("button", { name: t.my.archive })).toBeOnTheScreen();
    expect(new URL(fetchMock.mock.calls.at(-1)[0]).searchParams.get("tab")).toBe("pending");
    expect(screen.getByRole("button", { name: "მოდერაციაზე (1)" })).toBeSelected();
  });

  it("says when a tab is empty", async () => {
    serve({ "/api/v1/me": answer(signedIn()), "/api/v1/my-listings": page("expiring", { archived: 2 }, []) });
    await renderApp(<MyListingsScreen />);
    expect(await screen.findByText(t.myListings.emptyTab)).toBeOnTheScreen();
  });

  it("moves up, renews, takes down and deletes a draft, saying how each went", async () => {
    const draft = mine(10, "DRAFT", { title: "", price: 0, address: "", images: [] });
    const fetchMock = serve({
      "/api/v1/me": answer(signedIn()),
      "/api/v1/my-listings": page("active", counts, [mine(7, "ACTIVE", { canBump: true }), mine(9, "ARCHIVED", { canRenew: true }), draft]),
      "POST /api/v1/my-listings/7/bump": answer({ ok: true }),
      "POST /api/v1/my-listings/9/renew": answer({ error: "failed" }, 409),
      "POST /api/v1/my-listings/7/archive": answer({ ok: true }),
      "DELETE /api/v1/my-listings/10": answer({ ok: true }),
    });
    await renderApp(<MyListingsScreen />);
    const active = await screen.findByTestId("mine-7");
    await fireEvent.press(within(active).getByRole("button", { name: t.myListings.bump }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(t.feedback.bumped));
    const reads = fetchMock.mock.calls.filter(([url]) => url.includes("/my-listings?") || url.endsWith("/my-listings")).length;
    expect(reads).toBe(2);

    const archived = screen.getByTestId("mine-9");
    expect(within(archived).getByText(t.myListings.expired)).toBeOnTheScreen();
    expect(within(archived).queryByRole("button", { name: t.my.archive })).not.toBeOnTheScreen();
    await fireEvent.press(within(archived).getByRole("button", { name: t.myListings.renew }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(t.feedback.failed));

    await fireEvent.press(within(screen.getByTestId("mine-7")).getByRole("button", { name: t.my.archive }));
    await sayYes(t.my.confirmArchive);
    await waitFor(() => expect(alert).toHaveBeenCalledWith(t.feedback.archived));

    const unfinished = screen.getByTestId("mine-10");
    expect(within(unfinished).getByText(t.ui.draftTitle)).toBeOnTheScreen();
    // Named by what it is so far.
    expect(within(unfinished).getByText(cardTitle(draft as unknown as PublicListing, "ka", t))).toBeOnTheScreen();
    expect(within(unfinished).queryByText(/ნახვა:/)).not.toBeOnTheScreen();
    await fireEvent.press(within(unfinished).getByRole("button", { name: t.ui.deleteDraft }));
    await sayYes(t.ui.confirmDeleteDraft);
    await waitFor(() => expect(alert).toHaveBeenCalledWith(t.ui.draftDeleted));
    expect(fetchMock.mock.calls.some(([url, init]) => url.endsWith("/my-listings/10") && init.method === "DELETE")).toBe(true);
  });

  it("never shows a tab's answer that comes after another tab was opened", async () => {
    const late = deferred();
    const lost = deferred();
    serve({
      "/api/v1/me": answer(signedIn()),
      "/api/v1/my-listings": [
        page("active", counts, [mine(7, "ACTIVE")]),
        late.reply,
        page("active", counts, [mine(7, "ACTIVE")]),
        lost.reply,
        page("active", counts, [mine(7, "ACTIVE")]),
      ],
    });
    await renderApp(<MyListingsScreen />);
    await screen.findByTestId("mine-7");
    await fireEvent.press(screen.getByRole("button", { name: "მოდერაციაზე (1)" }));
    await fireEvent.press(screen.getByRole("button", { name: "აქტიური (1)" }));
    await screen.findByTestId("mine-7");
    late.resolve(page("pending", counts, [mine(8, "PENDING")]));
    await fireEvent.press(screen.getByRole("button", { name: "მოდერაციაზე (1)" }));
    await fireEvent.press(screen.getByRole("button", { name: "აქტიური (1)" }));
    await screen.findByTestId("mine-7");
    lost.reject(new TypeError("offline"));
    await waitFor(() => expect(screen.getByTestId("mine-7")).toBeOnTheScreen());
    expect(screen.queryByTestId("mine-8")).not.toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "თავიდან ცდა" })).not.toBeOnTheScreen();
  });
});
