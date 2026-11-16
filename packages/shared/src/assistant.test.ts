import { describe, expect, it } from "vitest";
import { assistantChoices, nextAssistantStep, type AssistantStep, type SearchParams } from "./assistant";
import { getDictionary } from "./i18n";
import { cityAreas, parseListingFilters } from ".";

const t = getDictionary("en");
const choices = (step: AssistantStep, params: SearchParams = {}) => assistantChoices(step, params, t, "en");

describe("nextAssistantStep", () => {
  it("asks every question for an apartment in a city with districts", () => {
    // Answers with the first choice each time: buy, apartment, Tbilisi, its first area, and so on.
    let params: SearchParams = {};
    const asked: AssistantStep[] = [];
    for (let step = nextAssistantStep(asked, params); step; step = nextAssistantStep(asked, params)) {
      asked.push(step);
      params = { ...params, ...choices(step, params)[0].params };
    }
    expect(asked).toEqual(["deal", "type", "city", "area", "budget", "rooms", "building", "market"]);
  });

  it("skips questions whose filters are already set, as typed text can do", () => {
    const params = { deal: "rent", city: "თბილისი", district: "ვაკე", priceMax: "800", belowMarket: "1" };
    expect(nextAssistantStep([], params)).toBe("type");
    expect(nextAssistantStep(["type"], params)).toBeNull();
  });

  it("skips questions that do not apply", () => {
    expect(nextAssistantStep(["deal", "type"], { deal: "sale", type: "land" })).toBe("city");
    expect(nextAssistantStep(["deal", "type", "city"], { deal: "sale", type: "land" })).toBe("budget");
    expect(nextAssistantStep(["deal", "type", "city", "budget"], { deal: "sale", type: "land" })).toBe("market");
    expect(nextAssistantStep(["deal", "type", "city", "budget", "market"], { deal: "sale", type: "land" })).toBeNull();
    expect(nextAssistantStep(["deal", "type", "city", "budget"], { deal: "rent", type: "house" })).toBe("rooms");
    expect(nextAssistantStep(["deal", "type", "city", "budget", "rooms"], { deal: "rent", type: "house" })).toBe("market");
  });
});

describe("assistantChoices", () => {
  it("offers the three main deals, with no way to skip", () => {
    expect(choices("deal").map((c) => c.params)).toEqual([{ deal: "sale" }, { deal: "rent" }, { deal: "daily" }]);
  });

  it("ends every other question with a choice that adds nothing", () => {
    for (const step of ["type", "city", "rooms", "building", "market"] as const) expect(choices(step).at(-1)).toEqual({ label: "Any", params: {} });
  });

  it("turns an area into all of its districts", () => {
    const area = cityAreas("თბილისი").find((a) => a.districts.length > 1)!;
    const choice = choices("area", { city: "თბილისი" }).find((c) => c.params.district === area.districts.join("|"))!;
    expect(parseListingFilters({ city: "თბილისი", ...choice.params }).district).toEqual(area.districts);
  });

  it("gives budget bands per deal, with the unit for rent", () => {
    const sale = choices("budget", { deal: "sale" });
    expect(sale[0]).toEqual({ label: "Up to $50,000", params: { priceMax: "50000" } });
    expect(sale[1]).toEqual({ label: "$50,000 – $100,000", params: { priceMin: "50000", priceMax: "100000" } });
    expect(sale.at(-2)).toEqual({ label: "From $250,000", params: { priceMin: "250000" } });
    expect(choices("budget", { deal: "rent" })[0].label).toBe("Up to $500 / month");
  });

  it("labels rooms, building and cities in the page language", () => {
    expect(choices("rooms")[1]).toEqual({ label: "2-room", params: { rooms: "2" } });
    expect(choices("market")[0]).toEqual({ label: "Yes, below market only", params: { belowMarket: "1" } });
    expect(choices("building")[1]).toEqual({ label: "New building", params: { building: "new" } });
    expect(choices("type")[0]).toEqual({ label: "Apartment", params: { type: "apartment" } });
    expect(choices("city")[0]).toEqual({ label: "Tbilisi", params: { city: "თბილისი" } });
  });
});
